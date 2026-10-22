import { toAsciiDigits } from './languageTools';

/** Recognising application references and "continue my application" (pure: browser and server). */

const LETTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const DIGIT_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', to: '2', too: '2', three: '3', four: '4', for: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ek: '1', do: '2', teen: '3', char: '4', chaar: '4', paanch: '5', chhe: '6', saat: '7', aath: '8', nau: '9',
  शून्य: '0', एक: '1', दो: '2', तीन: '3', चार: '4', पांच: '5', पाँच: '5', छह: '6', सात: '7', आठ: '8', नौ: '9',
};

/** Pull an application reference (UD-ABCD-2345) out of typed or spoken text. */
export function findReference(text: string): string | null {
  const joined = toAsciiDigits(text)
    .split(/[\s,.\-–—]+/)
    .map((w) => DIGIT_WORDS[w.toLowerCase()] ?? w)
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  // The last "UD" followed by 8 valid characters ("you D" is heard as YOUD, which also contains UD)
  let found: string | null = null;
  for (let i = joined.indexOf('UD'); i >= 0; i = joined.indexOf('UD', i + 1)) {
    const code = joined.slice(i + 2, i + 10);
    if (code.length === 8 && [...code].every((c) => LETTERS.includes(c))) found = code;
  }
  return found ? `UD-${found.slice(0, 4)}-${found.slice(4)}` : null;
}

/** True when what the caller said is about continuing an application (a reference, or "continue my form"). */
export const isApplicationRequest = (text: string) =>
  Boolean(findReference(text)) || (CONTINUE_APPLICATION.test(text) && CONTINUE_VERB.test(text));

export const CONTINUE_VERB = /continue|resume|complete|finish|fill|jaari|पूरा|भर|जारी|पूर्ण|सुरू ठेव|தொடர|நிரப்ப|முடிக்க|కొనసాగించ|పూర్తి|నింప|ಮುಂದುವರಿಸ|ಪೂರ್ಣ|ಭರ್ತಿ|തുടര|പൂരിപ്പിക്ക|പൂർത്തി|চালিয়ে|পূরণ|শেষ কর|ચાલુ|ભર|પૂર્ણ|ਜਾਰੀ|ਪੂਰਾ|ਭਰ|ଜାରି|ପୂରଣ|ଶେଷ କର|جاری|مکمل|بھر/i;

/** Words that mean the caller wants to continue an application. */
export const CONTINUE_APPLICATION = /\b(application|form|reference|aavedan|avedan|my form|continue)\b|आवेदन|फ़ॉर्म|फॉर्म|अर्ज|फॉर्म|விண்ணப்ப|படிவ|దరఖాస్తు|ఫారం|ಅರ್ಜಿ|ಫಾರ್ಮ್|അപേക്ഷ|ഫോം|আবেদন|ফর্ম|અરજી|ફોર્મ|ਅਰਜ਼ੀ|ਫਾਰਮ|ଆବେଦନ|ଫର୍ମ|درخواست|فارم/i;
