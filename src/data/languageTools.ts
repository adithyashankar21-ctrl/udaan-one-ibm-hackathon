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
