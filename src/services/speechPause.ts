/**
 * How long to wait after the person stops talking before treating what they said as done.
 * Finished sentences are answered quickly; a sentence that trails off ("I want to apply for…")
 * or is still being recognised gets more time so the person is not cut off mid-thought.
 */

/** Finished sentence: the browser has a final result and it does not trail off. */
export const PAUSE_DONE_MS = 700;
/** Words are still being recognised (interim text), so the person is probably mid-word. */
export const PAUSE_STILL_HEARING_MS = 1500;
/** The sentence ends on a word that needs more after it. */
export const PAUSE_UNFINISHED_MS = 2300;

// Words a sentence rarely ends on: connectives, articles, prepositions, possessives and fillers.
// Covers English, Hindi (Devanagari and romanised) and common words in the other app languages.
const TRAILING = new Set(
  [
    // English
    'and', 'or', 'but', 'so', 'because', 'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'at', 'with', 'from', 'about', 'into', 'by',
    'my', 'our', 'your', 'his', 'her', 'their', 'is', 'am', 'are', 'was', 'were', 'be', 'that', 'which', 'who', 'if', 'then', 'than',
    'want', 'need', 'like', 'apply', 'i', "i'm", 'um', 'uh', 'er', 'erm', 'hmm', 'also', 'some', 'any', 'this', 'these', 'those',
    // Hindi (Devanagari)
    'और', 'या', 'लेकिन', 'पर', 'का', 'की', 'के', 'को', 'में', 'से', 'मेरा', 'मेरी', 'मेरे', 'मुझे', 'हमारा', 'हमारी', 'क्योंकि', 'कि', 'तो', 'जो', 'अगर', 'एक', 'अं', 'उम्म',
    // Hindi (romanised)
    'aur', 'ya', 'lekin', 'ka', 'ki', 'ke', 'ko', 'mein', 'me', 'se', 'mera', 'meri', 'mere', 'mujhe', 'kyunki', 'agar', 'ek',
    // Marathi, Bengali, Gujarati, Punjabi, Urdu
    'आणि', 'किंवा', 'माझा', 'माझी', 'এবং', 'আর', 'আমার', 'અને', 'મારું', 'મારી', 'ਅਤੇ', 'ਮੇਰਾ', 'ਮੇਰੀ', 'اور', 'یا', 'میرا', 'میری', 'کا', 'کی', 'کے',
    // Tamil, Telugu, Kannada, Malayalam, Odia
    'மற்றும்', 'என்', 'எனது', 'మరియు', 'నా', 'ಮತ್ತು', 'ನನ್ನ', 'ഒപ്പം', 'എന്റെ', 'ଏବଂ', 'ମୋର',
  ].map((w) => w.toLowerCase()),
);

/** True when the text ends in a way that suggests more is coming. */
export function soundsUnfinished(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[,;:\-–—…]$/.test(t)) return true;
  const last = t.split(/\s+/).pop()!.replace(/[.!?।॥"'”’)]+$/u, '').toLowerCase();
  return TRAILING.has(last);
}

/**
 * Milliseconds of silence to wait before sending `text`.
 * `stillHearing` is true while the browser is still giving interim (not yet final) words.
 */
export function pauseBeforeDone(text: string, stillHearing: boolean): number {
  if (soundsUnfinished(text)) return PAUSE_UNFINISHED_MS;
  if (stillHearing) return PAUSE_STILL_HEARING_MS;
  return PAUSE_DONE_MS;
}
