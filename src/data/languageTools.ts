import type { LanguageCode } from '../types';

/** Every supported language, as the English name used in AI prompts. */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi',
  or: 'Odia',
  ur: 'Urdu',
};

const CODES = Object.keys(LANGUAGE_NAMES) as LanguageCode[];

/** A language code from a code, locale ("ta-IN") or English name ("Tamil"); English if unknown. */
export function toLanguageCode(value?: string): LanguageCode {
  const v = (value || '').toLowerCase().trim();
  const byCode = CODES.find((c) => v === c || v.startsWith(`${c}-`));
  if (byCode) return byCode;
  if (v.includes('oriya')) return 'or';
  if (v.includes('bangla')) return 'bn';
  return CODES.find((c) => v.includes(LANGUAGE_NAMES[c].toLowerCase())) || 'en';
}

/**
 * The language a text is written in, from its script. Devanagari is shared by Hindi and
 * Marathi, so it keeps `fallback` when that is Marathi; Latin text returns `fallback`.
 */
export function scriptLanguage(text: string, fallback: LanguageCode = 'en'): LanguageCode {
  if (/[஀-௿]/.test(text)) return 'ta';
  if (/[ఀ-౿]/.test(text)) return 'te';
  if (/[ಀ-೿]/.test(text)) return 'kn';
  if (/[ഀ-ൿ]/.test(text)) return 'ml';
  if (/[ऀ-ॿ]/.test(text)) return fallback === 'mr' ? 'mr' : 'hi';
  if (/[ঀ-৿]/.test(text)) return 'bn';
  if (/[઀-૿]/.test(text)) return 'gu';
  if (/[਀-੿]/.test(text)) return 'pa';
  if (/[଀-୿]/.test(text)) return 'or';
  if (/[؀-ۿ]/.test(text)) return 'ur';
  return fallback;
}

/** Zero digit of each Indian script (Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam) and Arabic-Indic. */
const DIGIT_ZEROS = [0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0x660, 0x6f0];

/** Digits written in any Indian script (or Urdu) as 0-9. */
export function toAsciiDigits(raw: string): string {
  return raw.replace(/[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const code = d.charCodeAt(0);
    const zero = DIGIT_ZEROS.find((z) => code >= z && code <= z + 9)!;
    return String(code - zero);
  });
}

/** Spoken digits 0-9 in every supported language (English and Hinglish too). */
const DIGIT_WORDS: string[][] = [
  ['zero', 'oh', 'o', 'shunya', 'shoonya', 'शून्य', 'பூஜ்ஜியம்', 'பூஜ்யம்', 'సున్నా', 'ಸೊನ್ನೆ', 'പൂജ്യം', 'শূন্য', 'શૂન્ય', 'ਸਿਫ਼ਰ', 'ਜ਼ੀਰੋ', 'ଶୂନ', 'ଶୂନ୍ୟ', 'صفر', 'ज़ीरो', 'जीरो'],
  ['one', 'ek', 'एक', 'ஒன்று', 'ఒకటి', 'ಒಂದು', 'ഒന്ന്', 'এক', 'એક', 'ਇੱਕ', 'ଏକ', 'ایک'],
  ['two', 'do', 'दो', 'दोन', 'இரண்டு', 'రెండు', 'ಎರಡು', 'രണ്ട്', 'দুই', 'બે', 'ਦੋ', 'ଦୁଇ', 'دو'],
  ['three', 'teen', 'tin', 'तीन', 'மூன்று', 'మూడు', 'ಮೂರು', 'മൂന്ന്', 'তিন', 'ત્રણ', 'ਤਿੰਨ', 'ତିନି', 'تین'],
  ['four', 'char', 'chaar', 'चार', 'நான்கு', 'నాలుగు', 'ನಾಲ್ಕು', 'നാല്', 'চার', 'ચાર', 'ਚਾਰ', 'ଚାରି', 'چار'],
  ['five', 'paanch', 'panch', 'पांच', 'पाँच', 'पाच', 'ஐந்து', 'ఐదు', 'ಐದು', 'അഞ്ച്', 'পাঁচ', 'પાંચ', 'ਪੰਜ', 'ପାଞ୍ଚ', 'پانچ'],
  ['six', 'chhe', 'che', 'chhah', 'छह', 'छः', 'छे', 'सहा', 'ஆறு', 'ఆరు', 'ಆರು', 'ആറ്', 'ছয়', 'છ', 'ਛੇ', 'ଛଅ', 'چھ', 'چھے'],
  ['seven', 'saat', 'सात', 'ஏழு', 'ఏడు', 'ಏಳು', 'ഏഴ്', 'সাত', 'સાત', 'ਸੱਤ', 'ସାତ', 'سات'],
  ['eight', 'aath', 'आठ', 'எட்டு', 'ఎనిమిది', 'ಎಂಟು', 'എട്ട്', 'আট', 'આઠ', 'ਅੱਠ', 'ଆଠ', 'آٹھ'],
  ['nine', 'nau', 'नौ', 'नऊ', 'ஒன்பது', 'తొమ్మిది', 'ಒಂಬತ್ತು', 'ഒമ്പത്', 'নয়', 'নয়', 'નવ', 'ਨੌਂ', 'ਨੌ', 'ନଅ', 'نو'],
];
const DIGIT_OF = new Map<string, string>(DIGIT_WORDS.flatMap((words, d) => words.map((w) => [w, String(d)] as [string, string])));
const REPEAT: Record<string, number> = { double: 2, triple: 3, dabal: 2, डबल: 2, ट्रिपल: 3 };

/**
 * A number said digit by digit ("nine eight double seven…", "नौ आठ सात…") as its digits, for
 * mobile, PIN, Aadhaar and account numbers. Null unless at least three digits were spoken.
 */
export function spokenDigits(text: string): string | null {
  const words = toAsciiDigits(text).toLowerCase().replace(/[.,!?।۔،]/g, ' ').split(/[\s-]+/).filter(Boolean);
  let out = '';
  let repeat = 1;
  let spoken = 0;
  for (const w of words) {
    if (REPEAT[w]) {
      repeat = REPEAT[w];
      continue;
    }
    const d = DIGIT_OF.get(w) ?? (/^\d+$/.test(w) ? w : null);
    if (d === null) continue;
    if (DIGIT_OF.has(w)) spoken++;
    out += d.repeat(repeat);
    repeat = 1;
  }
  return spoken >= 3 ? out : null;
}

/** The letters of each script (the full stop । is shared, so it is left out of Devanagari). */
const SCRIPT_LETTERS: Record<string, RegExp> = {
  deva: /[\u0900-\u0963\u0966-\u097F]/,
  beng: /[\u0980-\u09FF]/,
  guru: /[\u0A00-\u0A7F]/,
  gujr: /[\u0A80-\u0AFF]/,
  orya: /[\u0B00-\u0B7F]/,
  taml: /[\u0B80-\u0BFF]/,
  telu: /[\u0C00-\u0C7F]/,
  knda: /[\u0C80-\u0CFF]/,
  mlym: /[\u0D00-\u0D7F]/,
  arab: /[\u0600-\u06FF]/,
};
const SCRIPT_OF: Record<LanguageCode, string> = { en: '', hi: 'deva', mr: 'deva', bn: 'beng', pa: 'guru', gu: 'gujr', or: 'orya', ta: 'taml', te: 'telu', kn: 'knda', ml: 'mlym', ur: 'arab' };

/**
 * True when a translation into `lang` uses letters of another Indian script (or Urdu) that the
 * original did not have — for example a Hindi word inside Kannada. Language names written in
 * their own script in the original (a language menu) are allowed.
 */
export function mixesScripts(translation: string, lang: LanguageCode, original = ''): boolean {
  return Object.entries(SCRIPT_LETTERS).some(([script, re]) => script !== SCRIPT_OF[lang] && re.test(translation) && !re.test(original));
}

/** Code, CSS and template fragments that are never shown as words. */
const CODE_LIKE = /[={}<>[\]]|;\s*(?:$|[}\n])|\w\(|\):|^f"|\bvia-|--/;

/**
 * True when a translation still has English words in it. Only acronyms in capitals (PAN, IFSC,
 * PM-AJAY, NBFCs, e-KYC), the brand UDAAN ONE, web addresses, emails and {0} placeholders may
 * stay in Latin letters; names of banks, portals, places and schemes are written in the
 * language's own script.
 */
/**
 * Drops English glosses in brackets after a translated word, as in "चेकसम (checksum)" or
 * "ಎಸ್‌ವಿಎನಿಧಿ (SVANidhi)". A bracket the English text itself has, like "(RBI Sachet)", is
 * content and stays (its words are then written in the language's script); in "(ಸಚೇತ್ - Sachet)"
 * only the English half goes.
 */
export const dropEnglishGlosses = (translation: string, original = '') =>
  translation.replace(/([^\x00-\x7F][^\s(]*)\s*\(([^()]*)\)/g, (all, word: string, inner: string) => {
    if (!/[A-Za-z]/.test(inner)) return all;
    const native = inner.replace(/\s*[-–,/]?\s*[A-Za-z][A-Za-z0-9'’ .&/-]*$/, '').trim();
    if (native && !/[A-Za-z]/.test(native)) return `${word} (${native})`;
    if (native) return all;
    return original.includes(`(${inner.trim()})`) ? all : word;
  });

export function leavesEnglish(translation: string, original = ''): boolean {
  return englishWordsIn(translation, original).length > 0;
}

/**
 * Programming terms the Learning Hub teaches: they are typed exactly like this in code, so they
 * stay in Latin letters in every language.
 */
const CODE_TERMS = /(?<![A-Za-z])(?:Python|JavaScript|TypeScript|Java|HTML|CSS|NumPy|pandas|Matplotlib|SQL|MySQL|SQLite|Git|GitHub|VS Code|Jupyter|React|Node\.js|malloc|calloc|realloc|free|scanf|printf|args|kwargs|init|self|print|input|range|len|def|class|return|import|lambda|elif|else|while|for|if|try|except|finally|True|False|None|null|int|float|str|bool|list|dict|tuple|set|void|main|char|struct|pointer|[A-Z][a-z]+Error)(?![A-Za-z])/g;

/** The English words a translation still has (see leavesEnglish), so a retry can name them. */
export function englishWordsIn(translation: string, original = ''): string[] {
  // {0}, {1}… are number placeholders, not code
  if (CODE_LIKE.test(original.replace(/\{\d+\}/g, ''))) return [];
  const rest = translation
    // Code words quoted from the original stay as they are
    .replace(/"[^"]*"|`[^`]*`|\S*[_*]\S*/g, (m) => (original.includes(m.replace(/^"|"$/g, '')) ? ' ' : m))
    .replace(CODE_TERMS, (m) => (original.includes(m) ? ' ' : m))
    .replace(/https?:\/\/\S+|\S+@\S+\.\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:gov|nic|org|co|com|in|net|bank|sbi|money)\b\S*/gi, ' ')
    // Units after a number: 50cc, 5km, 2kg
    .replace(/(\d|\})(?:cc|km|kg|mm|cm|ml|kW|GB|MB)(?![A-Za-z])/g, '$1')
    // {0} numbers and {pa} personal details are placeholders
    .replace(/\{\d+\}|\{p[a-z]\}/g, ' ')
    .replace(/\b(?:[a-z]-)?[A-Z][A-Z0-9]*(?:[-.&/+][A-Z0-9]+)*s?\b/g, ' ');
  return [...new Set(rest.match(/[A-Za-z][A-Za-z'’-]*[A-Za-z]/g) || [])];
}

/**
 * Numbers in a text are translated as placeholders, so "3 questions left" and "5 questions left"
 * share one translation: maskNumbers gives the shared key and the numbers, unmaskNumbers puts
 * the numbers back into the translation.
 */
export function maskNumbers(text: string): { key: string; numbers: string[] } {
  const numbers: string[] = [];
  const key = text.replace(/\d+(?:[.,:/]\d+)*/g, (m) => `{${numbers.push(m) - 1}}`);
  return { key, numbers };
}

export const unmaskNumbers = (translation: string, numbers: string[]) => translation.replace(/\{(\d+)\}/g, (m, i) => numbers[Number(i)] ?? m);

/**
 * Translations are shared by everyone, so personal details must never be sent to the
 * translator or saved with a translation. maskPrivate swaps them for {pa}, {pb}… placeholders:
 * the `values` given (a person's name, address…) and IDs that are personal whoever they belong
 * to (application references, emails, PAN, IFSC, voter ID, passport numbers).
 */
const PRIVATE_PATTERNS = [
  /\bUD-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}\b/g,
  /[^\s@{}]+@[^\s@]+\.[A-Za-z]{2,}/g,
  /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  /\b[A-Z]{3}\d{7}\b/g,
  /\b[A-Z]\d{7}\b/g,
];
const privateSlot = (i: number) => `{p${String.fromCharCode(97 + i)}}`;

/** `values`: each placeholder with the detail it stands for. */
export function maskPrivate(text: string, values: string[] = []): { text: string; values: Array<[string, string]> } {
  const found: Array<[string, string]> = [];
  // Placeholders already in the text (masked by the browser) keep their letters
  let next = new Set(text.match(/\{p[a-z]\}/g) || []).size;
  const swap = (v: string) => {
    const had = found.find(([, x]) => x === v);
    if (had) return had[0];
    if (next >= 26) return v;
    const slot = privateSlot(next++);
    found.push([slot, v]);
    return slot;
  };
  let out = text;
  // Whole IDs first, so an email is hidden whole rather than name by name
  for (const re of PRIVATE_PATTERNS) out = out.replace(re, swap);
  for (const v of values) if (v && out.toLowerCase().includes(v.toLowerCase())) out = out.replace(new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), swap);
  return { text: out, values: found };
}

/** Puts the details back; null if the translation lost a placeholder (then use the English). */
export function unmaskPrivate(translation: string, values: Array<[string, string]>): string | null {
  let out = translation;
  for (const [slot, v] of values) {
    if (!out.includes(slot)) return null;
    out = out.split(slot).join(v);
  }
  return out;
}

/** Said when the AI service cannot be reached. */
export const OFFLINE_REPLIES: Record<LanguageCode, string> = {
  en: 'Sorry, I could not reach the AI service just now. Please try again in a moment. Meanwhile, you can browse schemes with official links under "Find Schemes", or call the toll-free helpline 1800-11-2529.',
  hi: 'माफ़ कीजिए, अभी AI सेवा से जुड़ नहीं पा रहा हूँ। कृपया थोड़ी देर बाद फिर कोशिश करें। तब तक "योजनाएँ खोजें" में आधिकारिक लिंक के साथ योजनाएँ देख सकते हैं, या टोल-फ्री नंबर 1800-11-2529 पर कॉल कर सकते हैं।',
  ta: 'மன்னிக்கவும், இப்போது AI சேவையுடன் இணைக்க முடியவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும். அதுவரை "திட்டங்கள்" பக்கத்தில் அதிகாரப்பூர்வ இணைப்புகளுடன் திட்டங்களைப் பார்க்கலாம், அல்லது 1800-11-2529 என்ற இலவச உதவி எண்ணை அழைக்கலாம்.',
  te: 'క్షమించండి, ఇప్పుడు AI సేవకు కనెక్ట్ కాలేకపోతున్నాను. కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి. అప్పటివరకు "పథకాలు" పేజీలో అధికారిక లింకులతో పథకాలు చూడవచ్చు, లేదా 1800-11-2529 టోల్-ఫ్రీ నంబర్‌కు కాల్ చేయవచ్చు.',
  kn: 'ಕ್ಷಮಿಸಿ, ಈಗ AI ಸೇವೆಗೆ ಸಂಪರ್ಕಿಸಲು ಆಗುತ್ತಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ. ಅಲ್ಲಿಯವರೆಗೆ "ಯೋಜನೆಗಳು" ಪುಟದಲ್ಲಿ ಅಧಿಕೃತ ಲಿಂಕ್‌ಗಳೊಂದಿಗೆ ಯೋಜನೆಗಳನ್ನು ನೋಡಬಹುದು, ಅಥವಾ 1800-11-2529 ಗೆ ಕರೆ ಮಾಡಬಹುದು.',
  ml: 'ക്ഷമിക്കണം, ഇപ്പോൾ AI സേവനവുമായി ബന്ധിപ്പിക്കാൻ കഴിയുന്നില്ല. അൽപ്പസമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കൂ. അതുവരെ "പദ്ധതികൾ" പേജിൽ ഔദ്യോഗിക ലിങ്കുകളോടെ പദ്ധതികൾ കാണാം, അല്ലെങ്കിൽ 1800-11-2529 എന്ന ടോൾ ഫ്രീ നമ്പറിൽ വിളിക്കാം.',
  mr: 'माफ करा, आत्ता AI सेवेशी जोडता आले नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा. तोपर्यंत "योजना शोधा" मध्ये अधिकृत लिंकसह योजना पाहू शकता, किंवा 1800-11-2529 या टोल-फ्री क्रमांकावर कॉल करू शकता.',
  bn: 'দুঃখিত, এই মুহূর্তে AI পরিষেবার সঙ্গে যোগাযোগ করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন। ততক্ষণ "প্রকল্প খুঁজুন" অংশে সরকারি লিংকসহ প্রকল্পগুলি দেখতে পারেন, অথবা 1800-11-2529 টোল-ফ্রি নম্বরে ফোন করতে পারেন।',
  gu: 'માફ કરશો, અત્યારે AI સેવા સાથે જોડાઈ શકાયું નથી. થોડી વાર પછી ફરી પ્રયાસ કરો. ત્યાં સુધી "યોજનાઓ શોધો" માં સત્તાવાર લિંક સાથે યોજનાઓ જોઈ શકો છો, અથવા 1800-11-2529 ટોલ-ફ્રી નંબર પર ફોન કરી શકો છો.',
  pa: 'ਮਾਫ਼ ਕਰਨਾ, ਇਸ ਵੇਲੇ AI ਸੇਵਾ ਨਾਲ ਜੁੜ ਨਹੀਂ ਸਕਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ। ਉਦੋਂ ਤੱਕ "ਯੋਜਨਾਵਾਂ ਲੱਭੋ" ਵਿੱਚ ਸਰਕਾਰੀ ਲਿੰਕਾਂ ਨਾਲ ਯੋਜਨਾਵਾਂ ਵੇਖ ਸਕਦੇ ਹੋ, ਜਾਂ 1800-11-2529 ਟੋਲ-ਫ੍ਰੀ ਨੰਬਰ ਤੇ ਫ਼ੋਨ ਕਰ ਸਕਦੇ ਹੋ।',
  or: 'କ୍ଷମା କରିବେ, ଏବେ AI ସେବା ସହ ଯୋଗାଯୋଗ ହୋଇପାରୁନାହିଁ। ଦୟାକରି କିଛି ସମୟ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ। ସେପର୍ଯ୍ୟନ୍ତ "ଯୋଜନା ଖୋଜନ୍ତୁ" ରେ ସରକାରୀ ଲିଙ୍କ ସହ ଯୋଜନା ଦେଖିପାରିବେ, କିମ୍ବା 1800-11-2529 ଟୋଲ୍-ଫ୍ରି ନମ୍ବରକୁ ଫୋନ୍ କରିପାରିବେ।',
  ur: 'معاف کیجیے، ابھی AI سروس سے رابطہ نہیں ہو سکا۔ براہ کرم تھوڑی دیر بعد پھر کوشش کریں۔ تب تک "اسکیمیں تلاش کریں" میں سرکاری لنک کے ساتھ اسکیمیں دیکھ سکتے ہیں، یا ٹول فری نمبر 1800-11-2529 پر کال کر سکتے ہیں۔',
};

/** The offline reply in the language the person wrote in, else the chosen language. */
export const offlineReply = (language: string, lastUserMsg: string) => OFFLINE_REPLIES[scriptLanguage(lastUserMsg, toLanguageCode(language))];
