/**
 * Spots "I want to learn / teach me …" requests in any channel (voice, chat, helpline)
 * so the assistant can teach in the conversation and hand off to the Learning Hub.
 * Works on Latin text and the main Indian scripts; the topic itself is passed on as text.
 */

const LEARN_WORDS = [
  // English
  /\b(learn|learning|teach|teaching|study|studying|tutorial|lesson|lessons|course|courses|training|train me|coaching|basics of|how to (code|program|repair|become))\b/i,
  // Hindi / Hinglish
  /(सीख|सिखा|पढ़|पढा|समझा|प्रशिक्षण|ट्रेनिंग|कोर्स|sikh(na|ni|ao|a do)|seekh|padh(na|ai|ao)|samjha)/i,
  // Tamil, Telugu, Kannada, Malayalam
  /(கற்|கற்று|பயிற்சி|படி|நేర్చు|నేర్పు|శిక్షణ|ಕಲಿ|ಕಲಿಸು|ತರಬೇತಿ|പഠി|പരിശീലന)/,
];

const COURSE_KEYWORDS: Array<[string, RegExp]> = [
  ['python', /\bpython\b|पायथन|பைத்தான்|పైథాన్|ಪೈಥಾನ್|പൈത്തൺ/i],
  ['dsa', /\b(dsa|data structures?|algorithms?|leetcode|coding interview|big[- ]?o|binary search|sorting|recursion)\b/i],
  ['c', /\bc (language|programming|program)\b|\bin c\b|\bpointers?\b|\bmalloc\b/i],
  ['java', /\bjava\b(?!script)|जावा/i],
  ['web', /\b(html|css|javascript|js|web ?development|website|web design|frontend|front-end|react)\b/i],
  ['sql', /\b(sql|database|databases|mysql|dbms|query|queries)\b/i],
  ['digital-basics', /\b(computer basics|basic computer|typing|e-?mail|internet|upi|digilocker|ms ?office|excel|word|powerpoint|spreadsheet|online fraud|cyber safety)\b|कंप्यूटर/i],
  ['career', /\b(spoken english|english speaking|resume|cv|interview|communication skills?|soft skills?|freelanc\w*)\b|अंग्रेज़ी|इंग्लिश/i],
];

/** Questions about schemes, money or documents belong to the scheme assistant, not the tutor. */
const NOT_LEARNING = /\b(scheme|schemes|yojana|loan|loans|stipend|grant|subsidy|eligib\w*|apply|application|certificate|card|pension|scholarship|pm[- ]?ajay|mudra|vishwakarma|daksh)\b|योजना|लोन|ऋण|प्रमाण/i;
const WEAK_LEARN = /\b(explain|understand|practice|practise|how to|what is|what are|difference|example)\b/i;

export interface LearnIntent {
  wantsToLearn: boolean;
  courseId: string | null;
  topic: string | null;
}

const FILLER =
  /\b(i|me|my|want|wanna|would|like|to|please|pls|can|could|you|u|help|learn|learning|teach|study|about|the|a|an|how|do|some|basics?|of|in|on|course|courses|training|tutorial|lesson|explain|understand|want to|need|kindly|guide|what|which|is|are|should|get|required|do i)\b/gi;

/** Short topic text for building a custom course, e.g. "mobile phone repair". */
function topicFrom(text: string) {
  const t = text
    .replace(/[?.!,।]/g, ' ')
    .replace(FILLER, ' ')
    .replace(/(मुझे|मैं|है|हैं|सीखना|सीखनी|सीखने|सीखो|चाहता|चाहती|के बारे में|बताओ|सिखाओ|सिखा दो|कैसे|करें)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length >= 2 ? t.slice(0, 80) : null;
}

export function detectLearnIntent(raw: string): LearnIntent {
  const text = String(raw || '').slice(0, 600);
  const course = COURSE_KEYWORDS.find(([, r]) => r.test(text))?.[0] || null;
  if (!course && NOT_LEARNING.test(text)) return { wantsToLearn: false, courseId: null, topic: null };
  const learnWord = LEARN_WORDS.some((r) => r.test(text));
  // With a known subject, "explain…", "what is…", "error…" are learning requests too
  const wantsToLearn = learnWord || Boolean(course && (WEAK_LEARN.test(text) || /\b(error|loop|function|variable|code|program|write|query|formula|formulas|help)\b/i.test(text)));
  if (!wantsToLearn) return { wantsToLearn: false, courseId: null, topic: null };
  return { wantsToLearn: true, courseId: course, topic: course ? null : topicFrom(text) };
}
