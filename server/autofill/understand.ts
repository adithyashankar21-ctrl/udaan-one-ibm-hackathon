/**
 * Understanding a spoken or chatted answer, not just copying it: "my name is Ramesh Kumar" is
 * "Ramesh Kumar", "I stitch clothes" is the option "Tailor (Darzi)", "45, no sorry 54" is 54,
 * "dhai lakh" is 250000. Clean answers are read instantly by rules; anything else goes to Gemini
 * with the question, the allowed options and every alternative the speech recogniser heard. The
 * result is always checked against the field's format before it is used.
 */
import { Type } from '@google/genai';
import type { FieldType } from '../../src/data/autofillSchema';
import type { Generate } from './ocr';
import { hasNonLatin, normalise, type Normalised } from './validate';

export interface AnswerField {
  label: string;
  type: FieldType | string;
  options?: string[];
  question?: string;
  help?: string;
}

/** What was said: the best transcript, plus other recognitions of the same speech. */
export interface Heard {
  text: string;
  alternatives?: string[];
  /** Speech recogniser confidence for `text`, 0–1, when it gives one. */
  confidence?: number;
}

export interface Understood extends Normalised {
  /** Read by Gemini (not by the quick rules). */
  interpreted?: boolean;
  /** A short question to ask when the answer could not be understood. */
  clarify?: string;
  /** Understood, but worth reading back to the person for a yes or no. */
  confirm?: boolean;
}

/* ── Quick rules ───────────────────────────────────────────────────── */

// Lead-ins people say before the value, in English, Hinglish and Hindi
const LEAD_IN = new RegExp(
  [
    '^(?:(?:ok(?:ay)?|so|well|um+|uh+|hmm+|ji|haan ji|sir|madam|ma\'?am)[\\s,]+)*',
    '(?:(?:my|our|the|his|her)\\s+[\\w\'’ ]{2,30}?\\s+(?:is|are|was)\\s+|(?:it|that|this)\\s*(?:is|\'s)\\s+|i\\s*(?:am|\'m)\\s+|we\\s+are\\s+|i\\s+live\\s+in\\s+|i\\s+was\\s+born\\s+(?:on|in)\\s+|',
    'mera\\s+[\\w ]{2,20}?\\s+hai\\s+|meri\\s+[\\w ]{2,20}?\\s+hai\\s+|mera\\s+naam\\s+|मेरा\\s+नाम\\s+|मेरी\\s+|मेरा\\s+)?',
  ].join(''),
  'i'
);
const TRAILER = /[\s,]*(?:hai|hain|he|hoon|hu|है|हैं|हूँ|हूं|ji|जी|sir|madam|thank you|thanks|please)[\s.!?।]*$/i;

/** "My name is Ramesh Kumar ji" → "Ramesh Kumar". Only common lead-ins; Gemini handles the rest. */
export function stripFiller(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  for (let i = 0; i < 2; i++) s = s.replace(LEAD_IN, '').replace(TRAILER, '').trim();
  return s.replace(/^["'“”‘’]+|["'“”‘’.]+$/g, '').trim() || raw.trim();
}

/** Words that mean the person changed their mind, hesitated or asked something back. */
const UNSURE =
  /(?:^|[\s,])(?:no wait|wait|sorry|actually|i mean|or|maybe|not sure|i don'?t know|what|why|which|how|matlab|nahi nahi|pata nahi|shayad|ya phir|मतलब|पता नहीं|शायद|या फिर|रुको)(?=$|[\s,.?!])/i;

const PLAIN_YES_NO = /^(?:yes|no|haan|han|ha|nahi|nahin|हाँ|हां|नहीं|ना)$/i;

/** Number words the quick rules read themselves (validate.ts), and words that change nothing. */
const NUMBER_WORD = /^(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|ek|do|teen|char|chaar|paanch|panch|chhe|che|saat|aath|nau|das|एक|दो|तीन|चार|पांच|पाँच|छह|छः|सात|आठ|नौ|दस|बीस|सौ)$/;
const HARMLESS = /^(?:rupees?|rs|inr|only|just|ji|hai|hain|है|हैं|जी|sir|madam|total|about|around|approx|approximately|lagbhag|लगभग)$/;

/**
 * True when the quick rules surely read the answer right, so asking Gemini would only add delay:
 * the answer is just the value, with no hesitation, correction or extra words.
 */
function isClean(field: AnswerField, said: string, n: Normalised): boolean {
  if (!n.ok || !n.value || UNSURE.test(said)) return false;
  const words = said.split(/\s+/).filter(Boolean);
  switch (field.type) {
    case 'select': {
      const opts = field.options || [];
      const exact = opts.some((o) => o.toLowerCase() === said.toLowerCase() || o.toLowerCase().split(/[\s(/]/)[0] === said.toLowerCase());
      return exact || (PLAIN_YES_NO.test(said) && opts.some((o) => /^(yes|no)$/i.test(o)));
    }
    case 'text':
      // Short, in English letters (other scripts must be transliterated) and no digits unless they belong to it
      return words.length <= 6 && !hasNonLatin(said);
    case 'aadhaar':
      return true;
    case 'number':
    case 'money':
      // Only the number: any other word may be a unit that changes it ("teen saal" for months is 36)
      return said
        .toLowerCase()
        .replace(/[\d\s,./₹-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .every((w) => NUMBER_WORD.test(w) || HARMLESS.test(w));
    default: {
      // Structured values (mobile, PIN, date…): the value and at most a couple of other words
      const rest = said.replace(/[\d\s,./₹-]+/g, ' ').trim().split(/\s+/).filter((w) => w.length > 1);
      return rest.length <= 3 && !hasNonLatin(said.replace(/[\d\s,./₹-]+/g, ''));
    }
  }
}

/* ── Gemini ────────────────────────────────────────────────────────── */

const TYPE_RULES: Record<string, string> = {
  text: 'Only the value itself, without lead-ins like "my name is" or "it is". Names, places and words in an Indian script are transliterated to English (Latin) letters, Title Case for names; drop honorifics like Shri, Smt, Mr, ji. If they say they have none, return "None".',
  date: 'DD/MM/YYYY. Understand spoken dates in any language ("pandrah agast unnis sau nabbe" = 15/08/1990). If only an age or only a year is given, understood=false and ask for the full date.',
  mobile: 'The 10-digit Indian mobile number, digits only. "double five" = 55, "triple nine" = 999. Drop +91 or a leading 0.',
  pincode: 'The 6-digit PIN code, digits only.',
  aadhaar: 'Digits only.',
  account: 'The bank account number, digits only ("double", "triple" repeat a digit).',
  ifsc: 'The 11-character IFSC code in capitals: 4 letters, the digit 0, then 6 letters or digits. Letters may be spelled out ("S B I N zero…").',
  pan: 'The 10-character PAN in capitals: 5 letters, 4 digits, 1 letter. Letters may be spelled out.',
  email: 'The email address in lower case ("at the rate" = @, "dot" = .). If they have none, return "None".',
  money: 'Rupees as digits only. 1 lakh = 100000, 1 crore = 10000000, "dhai lakh" = 250000, "dedh lakh" = 150000, "sawa lakh" = 125000, "50 hazar" = 50000. If the question asks for a yearly amount and they give a monthly one, multiply by 12. If they have none, return "0".',
  number: 'Digits only. Number words in any language become digits. If none, return "0".',
  select: 'Exactly one of the allowed options, copied exactly. Choose by meaning, not by matching words: "I stitch clothes" is a tailor option, "I am not married" is Single, "I do not own any land" is No, "no problem, go ahead" is Yes. If no option clearly fits, understood=false.',
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    understood: { type: Type.BOOLEAN },
    value: { type: Type.STRING },
    sure: { type: Type.BOOLEAN },
    clarify: { type: Type.STRING },
  },
  required: ['understood', 'value', 'sure'],
};

async function askGemini(generate: Generate, field: AnswerField, heard: Heard, timeoutMs: number) {
  const alts = [...new Set([heard.text, ...(heard.alternatives || [])].map((a) => a.trim()).filter(Boolean))].slice(0, 5);
  const prompt = `You help a person in India fill a government application by voice or chat. Understand what they MEAN and return the value to write on the English form.

Question asked: "${field.question || field.label}"
Form field: "${field.label}" (type: ${field.type})${field.options?.length ? `\nAllowed options: ${field.options.map((o) => `"${o}"`).join(', ')}` : ''}${field.help ? `\nHelp: ${field.help}` : ''}
What the speech recogniser heard (best first${heard.confidence !== undefined ? `, confidence ${heard.confidence.toFixed(2)}` : ''}; it can mishear, so use the alternative that makes most sense for this question):
${alts.map((a, i) => `${i + 1}. "${a.slice(0, 400)}"`).join('\n')}

Rules:
- Return only the value, never the whole sentence. ${TYPE_RULES[field.type] || TYPE_RULES.text}
- If they correct themselves, use the last value they gave ("45, no sorry 54" = 54).
- They may answer in any Indian language or mix languages; understand it either way.
- Never invent a value. If the answer does not give this information (it is about something else, a question back, or too unclear), understood=false.
- sure=false if you had to guess between readings, or the recogniser text looks garbled.
- clarify: when understood=false or sure=false, one short, friendly question in English that asks again for exactly what is needed (for example "Please say your 10-digit mobile number, one digit at a time."). Otherwise an empty string.`;
  const res = await generate(
    { contents: prompt, config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0, thinkingConfig: { thinkingBudget: 0 } } },
    // One fast model is enough to read a short answer
    ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    { retryBusy: false, timeoutMs }
  );
  const out = JSON.parse(res.text || '{}');
  return { understood: Boolean(out.understood), value: String(out.value || '').trim(), sure: out.sure !== false, clarify: String(out.clarify || '').trim() };
}

/* ── Entry point ───────────────────────────────────────────────────── */

/** Speech recognisers write in lower case: "ramesh kumar" → "Ramesh Kumar" for short text values. */
function tidy(type: FieldType, n: Normalised): Normalised {
  if (type !== 'text' || !n.value || n.value !== n.value.toLowerCase() || n.value.split(/\s+/).length > 6 || n.value === 'none') return n;
  return { ...n, value: n.value.replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, c: string) => sep + c.toUpperCase()) };
}

/** What to ask again when an answer was not understood and Gemini gave no question. */
const fallbackClarify = (field: AnswerField, n: Normalised) => n.error || `Sorry, I did not understand. ${field.question || `Please tell me your ${field.label.toLowerCase()}.`}`;

/**
 * Reads one answer for a form field. `exact` is for values typed straight into a form field:
 * they are only checked, never reinterpreted.
 */
export async function understandAnswer(generate: Generate, field: AnswerField, heard: Heard, opts: { exact?: boolean; timeoutMs?: number } = {}): Promise<Understood> {
  const raw = String(heard.text || '').trim();
  const type = field.type as FieldType;
  const direct = normalise(type, raw, field.options);
  if (opts.exact) {
    // Other scripts on a typed form still need transliterating to English
    if (direct.ok && !(type === 'text' && hasNonLatin(raw))) return direct;
  } else {
    const said = stripFiller(raw);
    const quick = said === raw ? direct : normalise(type, said, field.options);
    // Several recognitions that disagree: let Gemini choose between them
    const disagree = (heard.alternatives || []).some((a) => {
      const other = normalise(type, stripFiller(a), field.options);
      return other.ok && other.value !== quick.value;
    });
    if (isClean(field, said, quick) && !disagree && (heard.confidence === undefined || heard.confidence >= 0.6)) return tidy(type, quick);
  }
  if (type === 'aadhaar') return direct.ok ? direct : { ...direct, clarify: direct.error };

  try {
    const ai = await askGemini(generate, field, heard, opts.timeoutMs ?? 7000);
    if (ai.understood && ai.value) {
      const checked = normalise(type, ai.value, field.options);
      // A select value must be one of the options exactly
      const valid = checked.ok && (type !== 'select' || (field.options || []).includes(checked.value!));
      // Not quite sure: keep it, and the voice reads it back for a yes or no
      if (valid) return { ...checked, interpreted: true, confirm: !ai.sure || (heard.confidence !== undefined && heard.confidence < 0.5) };
      return { ok: false, error: checked.error || fallbackClarify(field, checked), clarify: ai.clarify || undefined, interpreted: true };
    }
    return { ok: false, error: ai.clarify || fallbackClarify(field, direct), clarify: ai.clarify || undefined, interpreted: true };
  } catch {
    // Gemini busy or slow: the quick rules on the cleaned answer are the best we have
    const said = opts.exact ? raw : stripFiller(raw);
    const n = normalise(type, said, field.options);
    return n.ok ? tidy(type, n) : { ...n, error: fallbackClarify(field, n) };
  }
}
