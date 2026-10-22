import { toAsciiDigits } from './languageTools';

/** Words people say to steer a voice conversation, in every supported language (pure: used in the browser and on the server). */

const words = (list: string, anchored = false) => new RegExp(`${anchored ? '^' : '(?:^|[\\s,.!?।۔،؟])'}(?:${list})(?=$|[\\s,.!?।۔،؟])`, 'i');
/**
 * Spoken commands in every supported language (English words too: people often say "scan" or
 * "done" in English whatever language they speak). Order: en/Hinglish, hi, mr, ta, te, kn, ml,
 * bn, gu, pa, or, ur.
 */
const VOCAB = {
  stop: 'stop|exit|cancel|band karo|bas|ruko|रुको|बंद करो|बस|थांबा|थांब|நிறுத்து|நிறுத்துங்கள்|போதும்|ఆపు|ఆపండి|చాలు|ನಿಲ್ಲಿಸು|ನಿಲ್ಲಿಸಿ|ಸಾಕು|നിർത്തൂ|നിർത്തുക|മതി|থামো|থামুন|বন্ধ করো|বন্ধ|બંધ કરો|બંધ|રોકો|બસ|ਰੁਕੋ|ਬੰਦ ਕਰੋ|ਬੱਸ|ବନ୍ଦ କର|ବନ୍ଦ|ରୁହ|ରୁକ|رکو|بس|بند کرو',
  skip: 'skip|next|chhodo|chodo|aage|बाद में|छोड़ो|छोड़ दो|अगला|पुढे|सोडा|वगळा|அடுத்து|அடுத்தது|தவிர்|విడిచిపెట్టు|తర్వాత|తరువాత|వదిలేయి|ಮುಂದೆ|ಬಿಡು|ಮುಂದಿನದು|അടുത്തത്|ഒഴിവാക്കൂ|বাদ দাও|বাদ দিন|পরের|પછી|છોડો|આગળ|ਛੱਡੋ|ਅੱਗੇ|ଛାଡ|ଆଗକୁ|ପରବର୍ତ୍ତୀ|چھوڑو|آگے|اگلا',
  repeat: 'repeat|again|dobara|phir se|what|दोबारा|फिर से|पुन्हा|परत|மீண்டும்|திரும்ப|మళ్ళీ|మళ్లీ|ಮತ್ತೆ|ಇನ್ನೊಮ್ಮೆ|വീണ്ടും|আবার|ফের|ફરીથી|ફરી|ਦੁਬਾਰਾ|ਫਿਰ ਤੋਂ|ପୁଣି|ଆଉଥରେ|دوبارہ|پھر سے',
  scan: 'scan|camera|upload|document|kagaz|kaagaz|स्कैन|कैमरा|दस्तावेज़|दस्तावेज|स्कॅन|कॅमेरा|ஸ்கேன்|கேமரா|స్కాన్|కెమెరా|ಸ್ಕ್ಯಾನ್|ಕ್ಯಾಮೆರಾ|സ്കാൻ|ക്യാമറ|স্ক্যান|ক্যামেরা|સ્કેન|કેમેરા|ਸਕੈਨ|ਕੈਮਰਾ|ସ୍କାନ|କ୍ୟାମେରା|اسکین|کیمرہ|کیمرا',
  capture: 'capture|click|take|photo lo|khicho|kheencho|खींचो|कैप्चर|क्लिक|काढा|कॅप्चर|கேப்சர்|எடு|క్యాప్చర్|తీయి|ಕ್ಯಾಪ್ಚರ್|ತೆಗೆ|ക്യാപ്ചർ|എടുക്കൂ|ক্যাপচার|তোলো|કેપ્ચર|લો|ਕੈਪਚਰ|ਖਿੱਚੋ|କ୍ୟାପଚର|ଉଠାଅ|کیپچر|کھینچو',
  done: 'done|finish|ho gaya|hogaya|हो गया|पूरा|झाले|झालं|पूर्ण|முடிந்தது|ஆச்சு|அயிந்தது|అయిపోయింది|అయింది|పూర్తి|ಆಯಿತು|ಮುಗಿಯಿತು|കഴിഞ്ഞു|തീർന്നു|হয়ে গেছে|শেষ|થઈ ગયું|પૂરું|ਹੋ ਗਿਆ|ਪੂਰਾ|ହୋଇଗଲା|ସରିଲା|ہو گیا|مکمل',
  answer: 'answer|jawab|bata|myself|khud|जवाब|बता|ख़ुद|खुद|उत्तर|सांगतो|சொல்கிறேன்|பதில்|చెప్తాను|జవాబు|ಹೇಳುತ್ತೇನೆ|ಉತ್ತರ|പറയാം|ഉത്തരം|উত্তর|বলব|જવાબ|કહીશ|ਜਵਾਬ|ਦੱਸਾਂਗਾ|ଉତ୍ତର|କହିବି|جواب|بتاؤں',
  photo: 'photo|foto|selfie|फ़ोटो|फोटो|ஃபோட்டோ|புகைப்படம்|ఫోటో|ಫೋಟೋ|ഫോട്ടോ|ফটো|ছবি|ફોટો|ਫੋਟੋ|ଫଟୋ|فوٹو|تصویر',
  read: 'read|padh|padho|suna|sunao|पढ़|सुना|वाचा|ऐकवा|படி|படிக்கவும்|சொல்லுங்கள்|చదువు|చదవండి|ಓದು|ಓದಿ|വായിക്കൂ|পড়ো|পড়ুন|વાંચો|ਪੜ੍ਹੋ|ପଢ|پڑھو|سناؤ',
  approve: 'approve|correct|sahi|theek|thik|manzoor|मंज़ूर|मंजूर|सही|ठीक|बरोबर|मान्य|ஒப்புதல்|சரி|ఆమోదం|సరి|సరే|ಅನುಮೋದನೆ|ಸರಿ|അംഗീകരിക്കൂ|ശരി|অনুমোদন|ঠিক আছে|ঠিক|મંજૂર|બરાબર|ਮਨਜ਼ੂਰ|ਠੀਕ|ଅନୁମୋଦନ|ଠିକ|منظور|صحیح|ٹھیک',
  download: 'download|save|डाउनलोड|सेव|डाउनलोड करा|டவுன்லோட்|பதிவிறக்கு|డౌన్‌లోడ్|ಡೌನ್‌ಲೋಡ್|ഡൗൺലോഡ്|ডাউনলোড|ડાઉનલોડ|ਡਾਊਨਲੋਡ|ଡାଉନଲୋଡ|ڈاؤن لوڈ',
  agree: 'agree|i agree|sahmat|सहमत|मान्य|ஒப்புக்கொள்கிறேன்|சம்மதம்|అంగీకరిస్తున్నాను|ಒಪ್ಪುತ್ತೇನೆ|സമ്മതം|রাজি|সম্মত|સંમત|ਸਹਿਮਤ|ରାଜି|ସହମତ|متفق|راضی',
  yes: 'yes|yeah|yep|ok|okay|haan|han|ha|hanji|ji|हाँ|हां|हा|जी|होय|हो|ஆம்|ஆமா|ஆமாம்|சரி|అవును|ಹೌದು|അതെ|ഉവ്വ്|হ্যাঁ|হাঁ|হ্যা|હા|ਹਾਂ|ਹਾਂਜੀ|ହଁ|ହଁ|ہاں|جی',
  change: 'change|correct it|edit|wrong|mistake|badlo|badal|galat|बदलो|बदलना|बदल|गलत|ग़लत|बदला|चूक|மாற்று|மாற்ற|தவறு|మార్చు|మార్చండి|తప్పు|ಬದಲಾಯಿಸು|ಬದಲಿಸಿ|ತಪ್ಪು|മാറ്റുക|മാറ്റണം|തെറ്റ്|বদলাও|বদলান|পরিবর্তন|ভুল|બદલો|ખોટું|ਬਦਲੋ|ਗਲਤ|ਗ਼ਲਤ|ବଦଳାଅ|ବଦଳାନ୍ତୁ|ଭୁଲ|بدلو|بدلیں|غلط',
  no: 'no|nope|nahi|nahin|not|नहीं|नही|ना|नाही|இல்லை|வேண்டாம்|లేదు|వద్దు|ಇಲ್ಲ|ಬೇಡ|ഇല്ല|വേണ്ട|না|নেই|ના|નહીં|ਨਹੀਂ|ନା|ନାହିଁ|نہیں|نا',
};

export const VOICE_COMMANDS = {
  stop: words(VOCAB.stop, true),
  skip: words(VOCAB.skip, true),
  repeat: words(VOCAB.repeat, true),
  scan: words(VOCAB.scan),
  capture: words(VOCAB.capture),
  done: words(VOCAB.done),
  answer: words(VOCAB.answer),
  photo: words(VOCAB.photo),
  read: words(VOCAB.read),
  approve: words(VOCAB.approve),
  download: words(VOCAB.download),
  agree: words(VOCAB.agree),
  yes: words(VOCAB.yes),
  no: words(VOCAB.no),
  change: words(VOCAB.change),
};

/** "One" / "first" / "दूसरा" … in every supported language, by position (1-based). */
const ORDINALS: string[] = [
  'one|first|ek|pehla|pahla|एक|पहला|पहिला|ஒன்று|ஒன்னு|முதல்|ఒకటి|మొదటి|ಒಂದು|ಮೊದಲ|ഒന്ന്|ആദ്യ|এক|প্রথম|એક|પહેલું|પહેલો|ਇੱਕ|ਪਹਿਲਾ|ଏକ|ପ୍ରଥମ|ایک|پہلا',
  'two|second|do|doosra|dusra|दो|दूसरा|दोन|दुसरा|இரண்டு|ரெண்டு|இரண்டாவது|రెండు|రెండవ|ಎರಡು|ಎರಡನೇ|രണ്ട്|രണ്ടാം|দুই|দ্বিতীয়|બે|બીજું|બીજો|ਦੋ|ਦੂਜਾ|ଦୁଇ|ଦ୍ୱିତୀୟ|دو|دوسرا',
  'three|third|teen|tisra|तीन|तीसरा|तिसरा|மூன்று|மூன்றாவது|మూడు|మూడవ|ಮೂರು|ಮೂರನೇ|മൂന്ന്|മൂന്നാം|তিন|তৃতীয়|ત્રણ|ત્રીજું|ਤਿੰਨ|ਤੀਜਾ|ତିନି|ତୃତୀୟ|تین|تیسرا',
].map((w) => words(w).source);

/** Which of `count` choices was spoken ("2", "two", "दूसरा"…), as a 0-based index, or -1. */
export function spokenIndex(text: string, count: number): number {
  const digit = toAsciiDigits(text).match(/(?:^|\D)([1-9])(?:\D|$)/);
  if (digit && Number(digit[1]) <= count && toAsciiDigits(text).replace(/\D/g, '').length === 1) return Number(digit[1]) - 1;
  // Highest first, so "the second one" is 2, not 1
  for (let i = Math.min(count, ORDINALS.length) - 1; i >= 0; i--) if (new RegExp(ORDINALS[i], 'i').test(text)) return i;
  return -1;
}

/** The field whose name was spoken, comparing with its English, Hindi and translated names. */
export function findField<F extends { label: string; labelHi?: string }>(heard: string, fields: F[], spokenLabels: string[]): F | null {
  const said = heard.toLowerCase().replace(/[.,!?।۔]/g, ' ').trim();
  const names = (f: F, i: number) =>
    [f.label, f.labelHi, spokenLabels.length === fields.length ? spokenLabels[i] : undefined]
      .filter((n): n is string => Boolean(n))
      .map((n) => n.toLowerCase().replace(/\s*\(.*?\)/g, '').trim());
  const scored = fields.map((f, i) => {
    let best = 0;
    for (const n of names(f, i)) {
      if (said.includes(n) || n.includes(said)) best = Math.max(best, 100 + n.length);
      const words = n.split(/[\s/'’-]+/).filter((w) => w.length >= 3);
      const hits = words.filter((w) => said.includes(w)).length;
      if (hits) best = Math.max(best, (hits / words.length) * 50 + hits);
    }
    return { f, best };
  });
  const top = scored.sort((a, b) => b.best - a.best)[0];
  return top && top.best >= 25 ? top.f : null;
}
