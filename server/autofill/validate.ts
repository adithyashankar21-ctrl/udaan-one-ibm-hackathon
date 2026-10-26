/**
 * Format validation and normalisation for form values.
 * These checks only test the shape of a value — they cannot confirm it is genuine.
 */
import type { FieldType } from '../../src/data/autofillSchema';
import { digitOfWord, spokenDigits, toAsciiDigits } from '../../src/data/languageTools';

/* Verhoeff checksum used by Aadhaar numbers */
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(num: string): boolean {
  if (!/^\d+$/.test(num)) return false;
  let c = 0;
  const digits = num.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}

/** A full 12-digit Aadhaar: correct length, cannot start with 0 or 1, passes Verhoeff. */
export function isValidAadhaar(digits: string): boolean {
  return /^[2-9]\d{11}$/.test(digits) && verhoeffValid(digits);
}

/** Replace any 12-digit Aadhaar-like sequence in free text with a masked form. */
export function scrubAadhaar(text: string): string {
  return text.replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, (_m, _a, _b, c) => `XXXX XXXX ${c}`);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Hindi month names as speech recognition writes them. */
const HINDI_MONTHS: Array<[RegExp, string]> = [
  [/जनवरी/, 'jan'], [/फ़?फरवरी|फ़रवरी/, 'feb'], [/मार्च/, 'mar'], [/अप्रैल/, 'apr'], [/मई/, 'may'], [/जून/, 'jun'],
  [/जुलाई/, 'jul'], [/अगस्त/, 'aug'], [/सितंबर|सितम्बर/, 'sep'], [/अक्टूबर|अक्तूबर/, 'oct'], [/नवंबर|नवम्बर/, 'nov'], [/दिसंबर|दिसम्बर/, 'dec'],
];

/** Month names in the other supported languages as speech recognition writes them (Jan to Dec). */
const MONTH_NAMES: string[][] = [
  ['जानेवारी', 'ஜனவரி', 'జనవరి', 'ಜನವರಿ', 'ജനുവരി', 'জানুয়ারি', 'જાન્યુઆરી', 'ਜਨਵਰੀ', 'ଜାନୁଆରୀ', 'جنوری'],
  ['फेब्रुवारी', 'பிப்ரவரி', 'ఫిబ్రవరి', 'ಫೆಬ್ರವರಿ', 'ഫെബ്രുവരി', 'ফেব্রুয়ারি', 'ફેબ્રુઆરી', 'ਫ਼ਰਵਰੀ', 'ਫਰਵਰੀ', 'ଫେବୃଆରୀ', 'فروری'],
  ['மார்ச்', 'మార్చి', 'ಮಾರ್ಚ್', 'മാർച്ച്', 'মার্চ', 'માર્ચ', 'ਮਾਰਚ', 'ମାର୍ଚ୍ଚ', 'مارچ'],
  ['एप्रिल', 'ஏப்ரல்', 'ఏప్రిల్', 'ಏಪ್ರಿಲ್', 'ഏപ്രിൽ', 'এপ্রিল', 'એપ્રિલ', 'ਅਪ੍ਰੈਲ', 'ਅਪਰੈਲ', 'ଏପ୍ରିଲ', 'اپریل'],
  ['மே', 'మే', 'ಮೇ', 'മേയ്', 'মে', 'મે', 'ਮਈ', 'ମଇ', 'مئی'],
  ['ஜூன்', 'జూన్', 'ಜೂನ್', 'ജൂൺ', 'জুন', 'જૂન', 'ਜੂਨ', 'ଜୁନ', 'جون'],
  ['जुलै', 'ஜூலை', 'జూలై', 'ಜುಲೈ', 'ജൂലൈ', 'জুলাই', 'જુલાઈ', 'ਜੁਲਾਈ', 'ଜୁଲାଇ', 'جولائی'],
  ['ऑगस्ट', 'ஆகஸ்ட்', 'ఆగస్టు', 'ಆಗಸ್ಟ್', 'ഓഗസ്റ്റ്', 'আগস্ট', 'ઓગસ્ટ', 'ਅਗਸਤ', 'ଅଗଷ୍ଟ', 'اگست'],
  ['सप्टेंबर', 'செப்டம்பர்', 'సెప్టెంబర్', 'ಸೆಪ್ಟೆಂಬರ್', 'സെപ്റ്റംബർ', 'সেপ্টেম্বর', 'સપ્ટેમ્બર', 'ਸਤੰਬਰ', 'ସେପ୍ଟେମ୍ବର', 'ستمبر'],
  ['ऑक्टोबर', 'அக்டோபர்', 'అక్టోబర్', 'ಅಕ್ಟೋಬರ್', 'ഒക്ടോബർ', 'অক্টোবর', 'ઓક્ટોબર', 'ਅਕਤੂਬਰ', 'ଅକ୍ଟୋବର', 'اکتوبر'],
  ['नोव्हेंबर', 'நவம்பர்', 'నవంబర్', 'ನವೆಂಬರ್', 'നവംബർ', 'নভেম্বর', 'નવેમ્બર', 'ਨਵੰਬਰ', 'ନଭେମ୍ବର', 'نومبر'],
  ['डिसेंबर', 'டிசம்பர்', 'డిసెంబర్', 'ಡಿಸೆಂಬರ್', 'ഡിസംബർ', 'ডিসেম্বর', 'ડિસેમ્બર', 'ਦਸੰਬਰ', 'ଡିସେମ୍ବର', 'دسمبر'],
];
const MONTH_KEYS = Object.keys(MONTHS);
const OTHER_MONTHS: Array<[RegExp, string]> = MONTH_NAMES.flatMap((names, i) => [...names].sort((a, b) => b.length - a.length).map((n) => [new RegExp(n), MONTH_KEYS[i]] as [RegExp, string]));

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, बीस: 20, सौ: 100,
};

/** "Ten" in the other supported languages (the digit words in languageTools cover 0-9). */
const TEN_WORDS = new Set(['दहा', 'பத்து', 'పది', 'ಹತ್ತು', 'പത്ത്', 'দশ', 'દસ', 'ਦਸ', 'ଦଶ', 'دس']);

/**
 * Speech-friendly clean-up before parsing: Indian-script digits to 0-9, Hindi month names to
 * English, and a lone number word ("five", "paanch", "पांच") to its digits.
 */
export function spokenToPlain(raw: string, numberWords = false, monthWords = false): string {
  let s = toAsciiDigits(raw);
  for (const [re, m] of HINDI_MONTHS) s = s.replace(re, m);
  // A month word in any other language; spaces keep it apart from the day and year
  if (monthWords) for (const [re, m] of OTHER_MONTHS) if (re.test(s)) { s = s.replace(re, ` ${m} `); break; }
  if (numberWords && !/\d/.test(s)) {
    const words = s.toLowerCase().replace(/[.,!?।]/g, ' ').split(/[\s-]+/).filter(Boolean);
    let total = 0;
    let found = false;
    for (const w of words) {
      const d = digitOfWord(w);
      const n = NUMBER_WORDS[w] ?? (d !== undefined ? Number(d) : TEN_WORDS.has(w) ? 10 : undefined);
      if (n === undefined) continue;
      found = true;
      total = n === 100 ? Math.max(1, total) * 100 : total + n;
    }
    if (found) s = `${s} ${total}`;
  }
  return s;
}

// Yes / no in every supported language: en, hi, mr, ta, te, kn, ml, bn, gu, pa, or, ur
const YES = /^(yes|yeah|yep|yup|ya|haan|han|ha|haa|hanji|ji haan|ji|sahi|bilkul|correct|हाँ|हां|हा|जी|जी हाँ|ठीक|बिल्कुल|होय|हो|ஆம்|ஆமா|ஆமாம்|అవును|ಹೌದು|അതെ|ഉവ്വ്|হ্যাঁ|হাঁ|হ্যা|হুঁ|હા|હાજી|ਹਾਂ|ਹਾਂਜੀ|ਜੀ|ହଁ|ହଁ|ହାଁ|ہاں|جی|جی ہاں)(\b|\s|,|۔|$)/i;
const NO = /^(no|nope|nah|nahi|nahin|nai|na|nil|none|never|bilkul nahi|नहीं|नही|ना|जी नहीं|नाही|இல்லை|வேண்டாம்|లేదు|వద్దు|ಇಲ್ಲ|ಬೇಡ|ഇല്ല|വേണ്ട|না|নেই|ના|નહીં|નથી|ਨਹੀਂ|ਨਾ|ନା|ନାହିଁ|نہیں|نا|جی نہیں)(\b|\s|,|۔|$)/i;

/** Parse many date spellings into DD/MM/YYYY, or null. */
export function normaliseDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let d: number, m: number, y: number;
  let match = s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})$/);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*,?\s+(\d{4})$/))) {
    [d, m, y] = [Number(match[1]), MONTHS[match[2]], Number(match[3])];
  } else if ((match = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) {
    [m, d, y] = [MONTHS[match[1]], Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (!m) return null;
  if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function ageFromDob(dob: string): number | null {
  const m = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const birth = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

/** Turn "2.5 lakh", "75,000", "₹ 1,20,000", "ढाई लाख" style amounts into a plain number string. */
export function normaliseMoney(raw: string): string | null {
  const s = raw.toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr|rupees?|रुपये|रुपए/g, '').trim();
  const num = s.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  let n = Number(num[1]);
  if (/lakh|lac|लाख|ലക്ഷ|லட்ச|లక్ష|ಲಕ್ಷ|লাখ|লক্ষ|લાખ|ਲੱਖ|ଲକ୍ଷ|لاکھ/.test(s)) n *= 100000;
  else if (/crore|करोड|कोटी|கோடி|కోటి|ಕೋಟಿ|കോടി|কোটি|કરોડ|ਕਰੋੜ|କୋଟି|کروڑ|cr\b/.test(s)) n *= 10000000;
  else if (/thousand|hazar|हज़ार|हजार|ஆயிரம்|వేయి|వెయ్యి|ಸಾವಿರ|ആയിരം|হাজার|હજાર|ਹਜ਼ਾਰ|ਹਜਾਰ|ହଜାର|ہزار|\bk\b/.test(s)) n *= 1000;
  if (!isFinite(n) || n < 0) return null;
  return String(Math.round(n));
}

export const isNone = (raw: string) => /^(none|no|nil|na|n\/a|not applicable|nahi|nahin|नहीं|नही|नाही|ना|இல்லை|లేదు|ಇಲ್ಲ|ഇല്ല|না|নেই|નથી|ના|નહીં|ਨਹੀਂ|ਨਾ|ନା|ନାହିଁ|نہیں|نا)[.।۔]?$/i.test(raw.trim());

export interface Normalised {
  ok: boolean;
  value?: string;
  /** Aadhaar: last four digits only. */
  last4?: string;
  checksumOk?: boolean;
  error?: string;
}

/**
 * Deterministic normalisation. Returns ok:false when the text does not clearly contain a
 * valid value — the caller may then ask Gemini to interpret free speech.
 */
export function normalise(type: FieldType, raw: string, options?: string[]): Normalised {
  let text = spokenToPlain(String(raw ?? '').trim(), type === 'number' || type === 'money', type === 'date').trim();
  // Numbers said digit by digit ("nine eight seven…") for digit-string fields
  if (type === 'mobile' || type === 'pincode' || type === 'aadhaar' || type === 'account') text = spokenDigits(text) ?? text;
  if (!text) return { ok: false, error: 'Empty answer' };
  const compact = text.replace(/[\s-]/g, '');

  switch (type) {
    case 'mobile': {
      const m = compact.replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, '').match(/[6-9]\d{9}/);
      return m && m[0].length === 10 ? { ok: true, value: m[0] } : { ok: false, error: 'Mobile numbers have 10 digits and start with 6, 7, 8 or 9' };
    }
    case 'pincode': {
      const m = text.match(/\b[1-9]\d{2}\s?\d{3}\b/);
      return m ? { ok: true, value: m[0].replace(/\s/g, '') } : { ok: false, error: 'PIN codes have 6 digits' };
    }
    case 'ifsc': {
      const m = compact.toUpperCase().match(/[A-Z]{4}0[A-Z0-9]{6}/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'IFSC codes have 11 characters: 4 letters, a zero, then 6 letters or digits' };
    }
    case 'pan': {
      const m = compact.toUpperCase().match(/[A-Z]{5}\d{4}[A-Z]/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'PAN has 10 characters, like ABCDE1234F' };
    }
    case 'email': {
      if (isNone(text)) return { ok: true, value: 'None' };
      const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      return m ? { ok: true, value: m[0].toLowerCase() } : { ok: false, error: 'That does not look like an email address' };
    }
    case 'account': {
      const m = compact.match(/\d{9,18}/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'Bank account numbers have 9 to 18 digits' };
    }
    case 'aadhaar': {
      const digits = compact.replace(/\D/g, '');
      if (digits.length === 12) {
        const ok = isValidAadhaar(digits);
        return ok
          ? { ok: true, last4: digits.slice(-4), checksumOk: true, value: `XXXX XXXX ${digits.slice(-4)}` }
          : { ok: false, error: 'That Aadhaar number does not pass the checksum — please check the digits' };
      }
      if (digits.length === 4) return { ok: true, last4: digits, value: `XXXX XXXX ${digits}` };
      return { ok: false, error: 'Type the last 4 digits of your Aadhaar (or upload the card)' };
    }
    case 'date': {
      const v = normaliseDate(text);
      return v ? { ok: true, value: v } : { ok: false, error: 'Use DD/MM/YYYY, for example 14/08/1993' };
    }
    case 'money': {
      if (isNone(text)) return { ok: true, value: '0' };
      const v = normaliseMoney(text);
      return v ? { ok: true, value: v } : { ok: false, error: 'Please give an amount in rupees' };
    }
    case 'number': {
      if (isNone(text)) return { ok: true, value: '0' };
      const m = text.match(/\d+/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'Please give a number' };
    }
    case 'select': {
      const opts = options || [];
      const lower = text.toLowerCase();
      // A negation anywhere wins: "ji nahi", "haan... nahi hai" mean no
      const no = isNone(text) || NO.test(text) || /\b(nahi|nahin|nai|not)\b|नहीं|नही/i.test(text);
      const yes = !no && YES.test(text);
      // Words of 4+ letters that identify an option ("tailor" → "Tailor (Darzi)")
      const words = (o: string) => o.toLowerCase().split(/[^a-z\u0900-\u0d7f\u0600-\u06ff]+/).filter((w) => w.length >= 4);
      const hit =
        opts.find((o) => o.toLowerCase() === lower) ||
        opts.find((o) => lower.includes(o.toLowerCase().split(/[\s(/]/)[0])) ||
        opts.find((o) => words(o).some((w) => lower.includes(w))) ||
        (yes ? opts.find((o) => /^yes$/i.test(o)) : undefined) ||
        (no ? opts.find((o) => /^no$/i.test(o)) : undefined);
      return hit ? { ok: true, value: hit } : { ok: false, error: `Choose one of: ${opts.join(', ')}` };
    }
    case 'text':
    default:
      if (isNone(text)) return { ok: true, value: 'None' };
      return { ok: true, value: text.replace(/\s+/g, ' ') };
  }
}

/** Validation of a stored value (used when building the form). Returns a problem or null. */
export function checkValue(type: FieldType, value: string, options?: string[], isBirthDate = false): string | null {
  if (!value) return null;
  if (type === 'aadhaar') return /^XXXX XXXX \d{4}$/.test(value) ? null : 'Aadhaar must be stored masked';
  if (type === 'text') return null;
  const n = normalise(type, value, options);
  if (!n.ok) return n.error || 'Invalid value';
  if (type === 'date' && isBirthDate) {
    const age = ageFromDob(n.value!);
    if (age !== null && (age < 10 || age > 100)) return `This date gives an age of ${age} — please check it`;
  }
  return null;
}

export const hasNonLatin = (s: string) => /[^\u0000-ɏ₹–—‘’“”]/.test(s);
