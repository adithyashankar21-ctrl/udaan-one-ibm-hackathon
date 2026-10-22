import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, 
  PhoneOff, 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff,
  Hash, 
  RotateCcw, 
  ShieldCheck, 
  Radio, 
  Check, 
  Sparkles,
  ArrowRight,
  Send,
  MessageSquare,
  Bot,
  User,
  Activity,
  AlertCircle,
  ExternalLink,
  Upload
} from 'lucide-react';
import { BeneficiaryProfile, LanguageCode, LivelihoodAnalysis } from '../types';
import { aiService, offlineReply } from '../services/aiService';
import { scriptLanguage, toAsciiDigits, toLanguageCode } from '../data/languageTools';
import { APPLY_INTENT_EVENT, type ApplyIntentDetail } from '../services/autofillApi';
import { isApplicationRequest, useIvrApplication } from './smartapply/useIvrApplication';

interface IvrHelplineProps {
  currentLanguage: LanguageCode;
  userProfile: BeneficiaryProfile;
  onUpdateProfile: (profile: Partial<BeneficiaryProfile>) => void;
  onGenerateRoadmap: () => void;
  roadmap: LivelihoodAnalysis | null;
  onOpenKaushalPatra: () => void;
}

interface LanguageBranch {
  code: LanguageCode;
  name: string;
  native: string;
  locale: string;
  agentGreeting: string;
  sampleVoicePills: string[];
}

const IVR_LANGUAGES: Record<string, LanguageBranch> = {
  '1': {
    code: 'en',
    name: 'English',
    native: 'English',
    locale: 'en-IN',
    agentGreeting:
      'Connected to PM-AJAY Live Helpline Agent. I can help with free NSQF skill courses, capital subsidy, or creating your roadmap. Please tell me your name, district, or what trade you want to pursue. To continue a form you started in Smart Apply, say its reference or press 4.',
    sampleVoicePills: [
      'I want to continue my application',
      'My name is Anitha from Madurai, I want tailoring training',
      'How to get capital subsidy under PM-AJAY?',
      'What courses are available in Agra for leather craft?',
      'Generate my PM-AJAY livelihood roadmap',
    ],
  },
  '2': {
    code: 'hi',
    name: 'Hindi',
    native: 'हिन्दी',
    locale: 'hi-IN',
    agentGreeting:
      'नमस्ते! PM-AJAY लाइव हेल्पलाइन काउंसलर से आपका संपर्क हो गया है। मैं आपको मुफ्त NSQF कोर्स, पूंजी अनुदान और आजीविका रोडमैप में मदद कर सकता हूँ। कृपया अपना नाम, जिला और पसंदीदा काम बताएं। Smart Apply में शुरू किया आवेदन जारी रखने के लिए उसका रेफ़रेंस बोलें या 4 दबाएं।',
    sampleVoicePills: [
      'मुझे अपना आवेदन पूरा करना है',
      'मेरा नाम रमेश है, मैं आगरा में चमड़े का काम करता हूँ',
      'PM-AJAY 50,000 रुपये पूंजी अनुदान कैसे मिलेगा?',
      'सोलर और बिजली मिस्त्री के कोर्स की जानकारी दें',
      'मेरा कौशल पत्र और आजीविका रोडमैप बनाओ',
    ],
  },
  '3': {
    code: 'ta',
    name: 'Tamil',
    native: 'தமிழ்',
    locale: 'ta-IN',
    agentGreeting:
      'வணக்கம்! PM-AJAY நேரடி உதவி மைய ஆலோசகரிடம் இணைக்கப்பட்டுள்ளீர்கள். இலவச NSQF பயிற்சி, மூலதன மானியம் பற்றி அறியலாம். உங்கள் பெயர், மாவட்டம் மற்றும் விருப்பமான தொழிலைக் கூறுங்கள்.',
    sampleVoicePills: [
      'என் பெயர் அனிதா, தையல் கடை வைக்க மானியம் வேண்டும்',
      'PM-AJAY மூலதன மானியம் எப்படி பெறுவது?',
      'மதுரை மாவட்டத்தில் ஆடை தயாரிப்பு பயிற்சி எங்குள்ளது?',
      'எனக்கான திறன் ரோட்மேப் உருவாக்குங்கள்',
    ],
  },
  '4': {
    code: 'te',
    name: 'Telugu',
    native: 'తెలుగు',
    locale: 'te-IN',
    agentGreeting:
      'నమస్కారం! PM-AJAY లైవ్ హెల్ప్‌లైన్ కౌన్సెలర్‌తో కనెక్ట్ అయ్యారు. ఉచిత NSQF శిక్షణ, సబ్సిడీ గురించి మాట్లాడవచ్చు. మీ పేరు, జిల్లా మరియు నైపుణ్యం వివరాలు చెప్పండి.',
    sampleVoicePills: [
      'నా పేరు రవి, బైక్ మెకానిక్ పని నేర్చుకోవాలి',
      'PM-AJAY వ్యాపార సబ్సిడీ వివరాలు చెప్పండి',
      'వరంగల్ జిల్లాలో ఉచిత శిక్షణ కేంద్రాలు ఎక్కడ ఉన్నాయి?',
      'నా లైవ్‌లీహుడ్ రోడ్‌మ్యాప్ తయారు చేయండి',
    ],
  },
  '5': {
    code: 'kn',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    locale: 'kn-IN',
    agentGreeting:
      'ನಮಸ್ಕಾರ! PM-AJAY ನೇರ ಸಹಾಯವಾಣಿ ಸಲಹೆಗಾರರೊಂದಿಗೆ ಸಂಪರ್ಕ ಹೊಂದಿದ್ದೀರಿ. ಉಚಿತ NSQF ತರಬೇತಿ, ಬಂಡವಾಳ ಸಬ್ಸಿಡಿ ಲಭ್ಯವಿದೆ. ನಿಮ್ಮ ಹೆಸರು, ಜಿಲ್ಲೆ ಮತ್ತು ಕಲಿಯಲು ಬಯಸುವ ಕೆಲಸವನ್ನು ತಿಳಿಸಿ.',
    sampleVoicePills: [
      'ನನ್ನ ಹೆಸರು ಮಂಜುನಾಥ್, ಸೋಲಾರ್ ಕೆಲಸ ಕಲಿಯಬೇಕು',
      'PM-AJAY ಬಂಡವಾಳ ಸಬ್ಸಿಡಿ ಹೇಗೆ ಪಡೆಯುವುದು?',
      'ಬೆಳಗಾವಿ ಜಿಲ್ಲೆಯಲ್ಲಿ ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ತರಬೇತಿ ಇದೆಯೇ?',
      'ನನ್ನ ಕೌಶಲ್ಯ ಪತ್ರ ರೋಡ್‌ಮ್ಯಾಪ್ ಸಿದ್ಧಪಡಿಸಿ',
    ],
  },
  '6': {
    code: 'ml',
    name: 'Malayalam',
    native: 'മലയാളം',
    locale: 'ml-IN',
    agentGreeting:
      'നമസ്കാരം! PM-AJAY ലൈവ് ഹെൽപ്പ്‌ലൈൻ കൗൺസിലറുമായി ബന്ധിപ്പിച്ചു. സൗജന്യ NSQF പരിശീലനം, മൂലധന സബ്‌സിഡി എന്നിവയെക്കുറിച്ച് സംസാരിക്കാം. നിങ്ങളുടെ പേര്, ജില്ല, ജോലി എന്നിവ പറയൂ.',
    sampleVoicePills: [
      'എന്റെ പേര് സുരേഷ്, ഡയറി ഫാം തുടങ്ങണം',
      'PM-AJAY സബ്‌സിഡി എങ്ങനെ ലഭിക്കും?',
      'പാലക്കാട് ജില്ലയിൽ ലഭ്യമായ കോഴ്സുകൾ ഏവ?',
      'എന്റെ റോഡ്‌മാപ്പ് തയാറാക്കൂ',
    ],
  },
  '7': {
    code: 'mr',
    name: 'Marathi',
    native: 'मराठी',
    locale: 'mr-IN',
    agentGreeting:
      'नमस्कार! PM-AJAY लाइव्ह हेल्पलाइन समुपदेशकाशी तुमचा संपर्क झाला आहे. मोफत NSQF प्रशिक्षण, भांडवली अनुदान आणि उपजीविका रोडमॅपसाठी मी मदत करू शकतो. कृपया तुमचे नाव, जिल्हा आणि आवडीचे काम सांगा. Smart Apply मध्ये सुरू केलेला अर्ज पुढे नेण्यासाठी त्याचा रेफरन्स सांगा किंवा 4 दाबा.',
    sampleVoicePills: [
      'मला माझा अर्ज पूर्ण करायचा आहे',
      'माझे नाव सुनीता, मला शिवणकाम शिकायचे आहे',
      'PM-AJAY भांडवली अनुदान कसे मिळेल?',
      'माझा उपजीविका रोडमॅप तयार करा',
    ],
  },
  '8': {
    code: 'bn',
    name: 'Bengali',
    native: 'বাংলা',
    locale: 'bn-IN',
    agentGreeting:
      'নমস্কার! PM-AJAY লাইভ হেল্পলাইন কাউন্সেলরের সঙ্গে আপনি যুক্ত হয়েছেন। বিনামূল্যে NSQF প্রশিক্ষণ, মূলধন ভর্তুকি এবং জীবিকা রোডম্যাপে আমি সাহায্য করতে পারি। আপনার নাম, জেলা আর পছন্দের কাজ বলুন। Smart Apply-তে শুরু করা আবেদন চালিয়ে যেতে তার রেফারেন্স বলুন বা 4 টিপুন।',
    sampleVoicePills: [
      'আমি আমার আবেদন শেষ করতে চাই',
      'আমার নাম রিনা, আমি সেলাইয়ের কাজ শিখতে চাই',
      'PM-AJAY মূলধন ভর্তুকি কীভাবে পাব?',
      'আমার জীবিকা রোডম্যাপ তৈরি করুন',
    ],
  },
  '9': {
    code: 'gu',
    name: 'Gujarati',
    native: 'ગુજરાતી',
    locale: 'gu-IN',
    agentGreeting:
      'નમસ્તે! PM-AJAY લાઇવ હેલ્પલાઇન કાઉન્સેલર સાથે તમારો સંપર્ક થયો છે. મફત NSQF તાલીમ, મૂડી સબસિડી અને આજીવિકા રોડમેપમાં હું મદદ કરી શકું છું. કૃપા કરીને તમારું નામ, જિલ્લો અને ગમતું કામ જણાવો. Smart Apply માં શરૂ કરેલી અરજી ચાલુ રાખવા તેનો રેફરન્સ બોલો અથવા 4 દબાવો.',
    sampleVoicePills: [
      'મારે મારી અરજી પૂરી કરવી છે',
      'મારું નામ મીના છે, મારે સિલાઈ શીખવી છે',
      'PM-AJAY મૂડી સબસિડી કેવી રીતે મળે?',
      'મારો આજીવિકા રોડમેપ બનાવો',
    ],
  },
  '0': {
    code: 'pa',
    name: 'Punjabi',
    native: 'ਪੰਜਾਬੀ',
    locale: 'pa-IN',
    agentGreeting:
      'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! PM-AJAY ਲਾਈਵ ਹੈਲਪਲਾਈਨ ਕਾਉਂਸਲਰ ਨਾਲ ਤੁਹਾਡਾ ਸੰਪਰਕ ਹੋ ਗਿਆ ਹੈ। ਮੁਫ਼ਤ NSQF ਸਿਖਲਾਈ, ਪੂੰਜੀ ਸਬਸਿਡੀ ਅਤੇ ਰੋਜ਼ੀ-ਰੋਟੀ ਰੋਡਮੈਪ ਵਿੱਚ ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਨਾਮ, ਜ਼ਿਲ੍ਹਾ ਅਤੇ ਪਸੰਦ ਦਾ ਕੰਮ ਦੱਸੋ। Smart Apply ਵਿੱਚ ਸ਼ੁਰੂ ਕੀਤੀ ਅਰਜ਼ੀ ਜਾਰੀ ਰੱਖਣ ਲਈ ਉਸਦਾ ਰੈਫ਼ਰੈਂਸ ਦੱਸੋ ਜਾਂ 4 ਦਬਾਓ।',
    sampleVoicePills: [
      'ਮੈਂ ਆਪਣੀ ਅਰਜ਼ੀ ਪੂਰੀ ਕਰਨੀ ਹੈ',
      'ਮੇਰਾ ਨਾਮ ਗੁਰਪ੍ਰੀਤ ਹੈ, ਮੈਂ ਬਿਜਲੀ ਦਾ ਕੰਮ ਸਿੱਖਣਾ ਹੈ',
      'PM-AJAY ਪੂੰਜੀ ਸਬਸਿਡੀ ਕਿਵੇਂ ਮਿਲੇਗੀ?',
      'ਮੇਰਾ ਰੋਜ਼ੀ-ਰੋਟੀ ਰੋਡਮੈਪ ਬਣਾਓ',
    ],
  },
  '*': {
    code: 'or',
    name: 'Odia',
    native: 'ଓଡ଼ିଆ',
    locale: 'or-IN',
    agentGreeting:
      'ନମସ୍କାର! PM-AJAY ଲାଇଭ୍ ହେଲ୍ପଲାଇନ୍ ପରାମର୍ଶଦାତାଙ୍କ ସହ ଆପଣଙ୍କ ସଂଯୋଗ ହୋଇଛି। ମାଗଣା NSQF ତାଲିମ, ପୁଞ୍ଜି ସବସିଡି ଏବଂ ଜୀବିକା ରୋଡମ୍ୟାପରେ ମୁଁ ସାହାଯ୍ୟ କରିପାରିବି। ଦୟାକରି ଆପଣଙ୍କ ନାମ, ଜିଲ୍ଲା ଏବଂ ପସନ୍ଦର କାମ କୁହନ୍ତୁ। Smart Apply ରେ ଆରମ୍ଭ କରିଥିବା ଆବେଦନ ଜାରି ରଖିବାକୁ ତାହାର ରେଫରେନ୍ସ କୁହନ୍ତୁ କିମ୍ବା 4 ଦବାନ୍ତୁ।',
    sampleVoicePills: [
      'ମୁଁ ମୋ ଆବେଦନ ସମ୍ପୂର୍ଣ୍ଣ କରିବାକୁ ଚାହୁଁଛି',
      'ମୋ ନାମ ସୁମିତ୍ରା, ମୁଁ ସିଲେଇ କାମ ଶିଖିବାକୁ ଚାହେଁ',
      'PM-AJAY ପୁଞ୍ଜି ସବସିଡି କିପରି ମିଳିବ?',
      'ମୋ ଜୀବିକା ରୋଡମ୍ୟାପ ପ୍ରସ୍ତୁତ କରନ୍ତୁ',
    ],
  },
  '#': {
    code: 'ur',
    name: 'Urdu',
    native: 'اردو',
    locale: 'ur-IN',
    agentGreeting:
      'آداب! PM-AJAY لائیو ہیلپ لائن کاؤنسلر سے آپ کا رابطہ ہو گیا ہے۔ مفت NSQF تربیت، سرمایہ سبسڈی اور روزگار روڈ میپ میں میں مدد کر سکتا ہوں۔ براہ کرم اپنا نام، ضلع اور پسند کا کام بتائیں۔ Smart Apply میں شروع کی گئی درخواست جاری رکھنے کے لیے اس کا ریفرنس بولیں یا 4 دبائیں۔',
    sampleVoicePills: [
      'مجھے اپنی درخواست مکمل کرنی ہے',
      'میرا نام سلمیٰ ہے، مجھے سلائی کا کام سیکھنا ہے',
      'PM-AJAY سرمایہ سبسڈی کیسے ملے گی؟',
      'میرا روزگار روڈ میپ بنائیں',
    ],
  },
};

// How long the caller must stay silent before their speech is sent to the agent
const CALLER_SILENCE_MS = 2000;

const getInitialLangKey = (lang?: string): string => {
  if (!lang) return '1';
  const code = toLanguageCode(lang);
  return Object.keys(IVR_LANGUAGES).find((k) => IVR_LANGUAGES[k].code === code) || '1';
};

/** Language names and greetings callers may say to choose a language, by keypad key. */
const SPOKEN_LANGUAGE_WORDS: Array<[string, RegExp]> = [
  ['7', /marathi|मराठी/i],
  ['3', /tamil|தமிழ்|இந்தி|vanakkam|வணக்கம்|three|மூன்று/i],
  ['2', /hindi|हिन्दी|हिंदी|namaste|नमस्ते|\btwo\b|\bदो\b/i],
  ['4', /telugu|తెలుగు|four|నాలుగు/i],
  ['5', /kannada|ಕನ್ನಡ|five|ಐದು/i],
  ['6', /malayalam|മലയാളം|\bsix\b|ആറ്/i],
  ['8', /bengali|bangla|বাংলা|eight|আট/i],
  ['9', /gujarati|ગુજરાતી|nine|નવ/i],
  ['0', /punjabi|ਪੰਜਾਬੀ|zero|sat sri akal|ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ/i],
  ['*', /odia|oriya|ଓଡ଼ିଆ|ଓଡିଆ|star/i],
  ['#', /urdu|اردو|adaab|آداب|hash/i],
  ['1', /english|\bone\b/i],
];

/** The menu key for the language a caller spoke or named; English when unclear. */
function spokenLanguageKey(text: string): string {
  const named = SPOKEN_LANGUAGE_WORDS.find(([, re]) => re.test(text));
  if (named) return named[0];
  const digit = toAsciiDigits(text).match(/^\s*(\d)\b/);
  if (digit && IVR_LANGUAGES[digit[1]]) return digit[1];
  return getInitialLangKey(scriptLanguage(text));
}

export const IvrHelpline: React.FC<IvrHelplineProps> = ({
  currentLanguage,
  userProfile,
  onUpdateProfile,
  onGenerateRoadmap,
  roadmap,
  onOpenKaushalPatra,
}) => {
  const initialKey = getInitialLangKey(currentLanguage);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentPromptStep, setCurrentPromptStep] = useState<number>(1); // 1 = Lang select, 2 = Live Agent Chat
  const [activeIvrKey, setActiveIvrKey] = useState<string>(initialKey);
  const [pressedKeys, setPressedKeys] = useState<string[]>([]);
  const [transcriptLog, setTranscriptLog] = useState<Array<{ speaker: string; text: string; time: string }>>([]);

  // Hardware microphone & live voice state
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [customInputText, setCustomInputText] = useState('');
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<any>(null);
  const pendingSpeechRef = useRef('');
  const carriedSpeechRef = useRef('');
  const handleCallerSpokenInputRef = useRef<(text: string) => void>(() => {});
  const logEndRef = useRef<HTMLDivElement>(null);

  // Synchronized refs to avoid stale closure issues in speech callbacks
  const callActiveRef = useRef(callActive);
  const isMicEnabledRef = useRef(isMicEnabled);
  const isRecordingMediaRef = useRef(isRecordingMedia);
  const isAgentSpeakingRef = useRef(isAgentSpeaking);
  const isProcessingRef = useRef(isProcessing);
  const activeBranchRef = useRef(IVR_LANGUAGES[activeIvrKey] || IVR_LANGUAGES['1']);
  const currentPromptStepRef = useRef(currentPromptStep);

  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    isMicEnabledRef.current = isMicEnabled;
  }, [isMicEnabled]);

  useEffect(() => {
    isRecordingMediaRef.current = isRecordingMedia;
  }, [isRecordingMedia]);

  useEffect(() => {
    isAgentSpeakingRef.current = isAgentSpeaking;
  }, [isAgentSpeaking]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    activeBranchRef.current = IVR_LANGUAGES[activeIvrKey] || IVR_LANGUAGES['1'];
  }, [activeIvrKey]);

  useEffect(() => {
    currentPromptStepRef.current = currentPromptStep;
  }, [currentPromptStep]);

  // Synchronize language when app language changes
  useEffect(() => {
    const newKey = getInitialLangKey(currentLanguage);
    if (!callActive) {
      setActiveIvrKey(newKey);
    }
  }, [currentLanguage, callActive]);

  const activeBranch = IVR_LANGUAGES[activeIvrKey] || IVR_LANGUAGES['1'];

  // Continuing a Smart Apply application inside the call (reference → questions → saved answers)
  const ivrApp = useIvrApplication({
    language: activeBranch.code,
    setBusy: setIsProcessing,
    say: async (text) => {
      const branch = activeBranchRef.current;
      setTranscriptLog((prev) => [...prev, { speaker: `Application desk (${branch.name})`, text, time: formatCallTime(callDuration) }]);
      stopLiveSpeechRecognition();
      setIsAgentSpeaking(true);
      // Short form prompts use the device voice: instant, so the back-and-forth never lags
      await aiService.speakQuick(text, branch.locale);
      setIsAgentSpeaking(false);
    },
  });

  // "I want to apply for …" heard in the call: take the application right here after the agent replies
  const pendingApplyRef = useRef<string | null>(null);
  useEffect(() => {
    const onIntent = (e: Event) => {
      const d = (e as CustomEvent<ApplyIntentDetail>).detail;
      if (callActiveRef.current && d.channel === 'helpline' && d.schemeId) pendingApplyRef.current = d.schemeId;
    };
    window.addEventListener(APPLY_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(APPLY_INTENT_EVENT, onIntent);
  }, []);

  // Scroll transcript to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLog, interimTranscript, isProcessing]);

  // Call timer
  useEffect(() => {
    let interval: any;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const formatCallTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Play realistic DTMF telephone touchtone
  const playDtmfTone = (digit: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750 + parseInt(digit || '1') * 60, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // AudioContext fallback
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const transcript = await aiService.transcribeAudioBlob(file, activeBranch.name);
      setIsProcessing(false);
      if (transcript && transcript.trim().length > 0) {
        handleCallerSpokenInput(transcript.trim());
      }
    } catch (err) {
      setIsProcessing(false);
      console.warn('Audio upload transcribe error:', err);
    }
  };

  // Request actual hardware microphone access and setup real-time visualizer
  const initMicrophoneStream = async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicErrorMessage('Microphone is not supported in this browser.');
      return false;
    }

    const isIframe = typeof window !== 'undefined' && window.self !== window.top;

    try {
      setMicErrorMessage(null);
      let stream: MediaStream | null = null;
      try {
        // High compatibility simple boolean constraint first
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err1) {
        // Fallback constraint
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      }

      mediaStreamRef.current = stream;
      setHasMicPermission(true);
      setIsMicEnabled(true);

      // Start live visualizer
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        let lastVoiceDetectedTime = 0;
        let isVadActive = false;

        const updateMeter = () => {
          if (!mediaStreamRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setMicVolumeLevel(level);

          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (audioErr) {
        console.warn('Audio meter initialization note:', audioErr);
      }

      return true;
    } catch (err: any) {
      console.warn('Microphone permission request error:', err);
      setHasMicPermission(false);
      setMicErrorMessage(
        'Please allow microphone access in your browser to speak directly. You can click "Retry Mic", or use the "Tap to Speak" / Voice query buttons.'
      );
      return false;
    }
  };

  const stopMicrophoneStream = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setMicVolumeLevel(0);
  };

  // Profile data extraction across English, Tamil, Telugu, Kannada, Malayalam, Hindi
  const analyzeAndExtractProfileData = (text: string) => {
    const lower = text.toLowerCase();
    const updates: Partial<BeneficiaryProfile> = {};

    // 1. Name extraction across languages
    const namePatterns = [
      /(?:my name is|i am|this is)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
      /(?:मेरा नाम|नाम है)\s+([^\s,]+(?:\s+[^\s,]+)?)/i,
      /(?:என் பெயர்|பெயர்)\s+([^\s,]+(?:\s+[^\s,]+)?)/i,
      /(?:నా పేరు|పేరు)\s+([^\s,]+(?:\s+[^\s,]+)?)/i,
      /(?:ನನ್ನ ಹೆಸರು|ಹೆಸರು)\s+([^\s,]+(?:\s+[^\s,]+)?)/i,
      /(?:എന്റെ പേര്|പേര്)\s+([^\s,]+(?:\s+[^\s,]+)?)/i,
    ];
    for (const pat of namePatterns) {
      const match = text.match(pat);
      if (match && match[1] && match[1].trim().length > 1) {
        updates.name = match[1].trim();
        break;
      }
    }

    // 2. District and State detection
    const districtMappings: Record<string, { district: string; state: string }> = {
      'madurai': { district: 'Madurai', state: 'Tamil Nadu' },
      'மதுரை': { district: 'Madurai', state: 'Tamil Nadu' },
      'tiruppur': { district: 'Tiruppur', state: 'Tamil Nadu' },
      'திருப்பூர்': { district: 'Tiruppur', state: 'Tamil Nadu' },
      'salem': { district: 'Salem', state: 'Tamil Nadu' },
      'சேலம்': { district: 'Salem', state: 'Tamil Nadu' },
      'chennai': { district: 'Chennai', state: 'Tamil Nadu' },
      'சென்னை': { district: 'Chennai', state: 'Tamil Nadu' },
      'warangal': { district: 'Warangal', state: 'Telangana' },
      'వరంగల్': { district: 'Warangal', state: 'Telangana' },
      'hyderabad': { district: 'Hyderabad', state: 'Telangana' },
      'హైదరాబాద్': { district: 'Hyderabad', state: 'Telangana' },
      'belagavi': { district: 'Belagavi', state: 'Karnataka' },
      'ಬೆಳಗಾವಿ': { district: 'Belagavi', state: 'Karnataka' },
      'mysuru': { district: 'Mysuru', state: 'Karnataka' },
      'ಮೈಸೂರು': { district: 'Mysuru', state: 'Karnataka' },
      'bengaluru': { district: 'Bengaluru Rural', state: 'Karnataka' },
      'ಬೆಂಗಳೂರು': { district: 'Bengaluru Rural', state: 'Karnataka' },
      'palakkad': { district: 'Palakkad', state: 'Kerala' },
      'പാലക്കാട്': { district: 'Palakkad', state: 'Kerala' },
      'thiruvananthapuram': { district: 'Thiruvananthapuram', state: 'Kerala' },
      'തിരുവനന്തപുരം': { district: 'Thiruvananthapuram', state: 'Kerala' },
      'agra': { district: 'Agra', state: 'Uttar Pradesh' },
      'आगरा': { district: 'Agra', state: 'Uttar Pradesh' },
      'kanpur': { district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
      'कानपुर': { district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
      'varanasi': { district: 'Varanasi', state: 'Uttar Pradesh' },
      'वाराणसी': { district: 'Varanasi', state: 'Uttar Pradesh' },
    };

    for (const [key, loc] of Object.entries(districtMappings)) {
      if (lower.includes(key)) {
        updates.district = loc.district;
        updates.state = loc.state;
        break;
      }
    }

    // 3. Education hints
    if (lower.includes('10th') || lower.includes('दसवीं') || lower.includes('matric') || lower.includes('பத்தாம்') || lower.includes('10వ') || lower.includes('10 ನೇ') || lower.includes('പത്താം')) {
      updates.education = '10th Pass';
    } else if (lower.includes('12th') || lower.includes('बारहवीं') || lower.includes('inter') || lower.includes('மேல்நிலை') || lower.includes('12వ') || lower.includes('ಪ್ಲಸ್ ಟೂ') || lower.includes('പ്ലസ് ടു')) {
      updates.education = '12th Pass';
    } else if (lower.includes('8th') || lower.includes('आठवीं') || lower.includes('8-ஆம்') || lower.includes('8వ') || lower.includes('8 ನೇ') || lower.includes('8-ാം')) {
      updates.education = '8th Pass';
    } else if (lower.includes('iti') || lower.includes('आईटीआई') || lower.includes('ஐடிஐ') || lower.includes('ఐటీఐ') || lower.includes('ಐಟಿಐ')) {
      updates.education = 'ITI Certified';
    } else if (lower.includes('graduate') || lower.includes('degree') || lower.includes('स्नातक') || lower.includes('பட்டதாரி') || lower.includes('డిగ్రీ') || lower.includes('ಪದವಿ') || lower.includes('ಬಿരുദം')) {
      updates.education = 'Graduate';
    }

    // 4. Trade / Occupation hints
    if (lower.includes('चमड़ा') || lower.includes('leather') || lower.includes('जूता') || lower.includes('shoe') || lower.includes('தோல்') || lower.includes('காலணி') || lower.includes('లెదర్') || lower.includes('ಚರ್ಮ') || lower.includes('തുകൽ')) {
      updates.traditionalTrade = 'Leather Footwear & Goods';
      updates.existingSkills = userProfile.existingSkills ? `${userProfile.existingSkills}, Leather crafting` : 'Leather stitching & assembly';
    }
    if (lower.includes('सिलाई') || lower.includes('tailor') || lower.includes('stitching') || lower.includes('कपड़े') || lower.includes('garment') || lower.includes('தையல்') || lower.includes('டைலரிங்') || lower.includes('ಟೈಲರಿಂಗ್') || lower.includes('തയ്യൽ')) {
      updates.existingSkills = userProfile.existingSkills ? `${userProfile.existingSkills}, Garment sewing` : 'Basic machine stitching';
      updates.currentOccupation = 'Tailoring / Garment Worker';
      updates.traditionalTrade = 'Tailoring & Garments';
    }
    if (lower.includes('solar') || lower.includes('सोलर') || lower.includes('बिजली') || lower.includes('electric') || lower.includes('சூரிய') || lower.includes('సూర్యమిత్ర') || lower.includes('ಸೋಲಾರ್') || lower.includes('സോളാർ')) {
      updates.existingSkills = 'Electrical & Wiring';
      updates.traditionalTrade = 'Solar Energy & Electrician';
    }
    if (lower.includes('डेयरी') || lower.includes('dairy') || lower.includes('गाय') || lower.includes('பால் பண்ணை') || lower.includes('పాడి') || lower.includes('ಹೈನುಗಾರಿಕೆ') || lower.includes('ക്ഷീരോൽപ്പാദനം')) {
      updates.currentOccupation = 'Dairy & Animal Husbandry';
      updates.traditionalTrade = 'Dairy & Animal Husbandry';
    }

    if (Object.keys(updates).length > 0) {
      onUpdateProfile(updates);
    }
    return updates;
  };

  // Send what the caller said only after they have been silent for a while,
  // so natural pauses between phrases don't cut them off mid-sentence.
  const armSilenceCommit = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    silenceTimeoutRef.current = setTimeout(() => {
      silenceTimeoutRef.current = null;
      commitPendingSpeech();
    }, CALLER_SILENCE_MS);
  };

  const commitPendingSpeech = () => {
    const text = pendingSpeechRef.current.trim();
    pendingSpeechRef.current = '';
    carriedSpeechRef.current = '';
    setInterimTranscript('');
    if (text) handleCallerSpokenInputRef.current(text);
  };

  // Stop active speech recognition safely
  const stopLiveSpeechRecognition = (keepPendingSpeech: boolean = false) => {
    if (!keepPendingSpeech) {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      pendingSpeechRef.current = '';
      carriedSpeechRef.current = '';
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Start continuous speech recognition with fresh instance every time
  const startLiveSpeechRecognition = (keepPendingSpeech: boolean = false) => {
    stopLiveSpeechRecognition(keepPendingSpeech);

    if (!callActiveRef.current || !isMicEnabledRef.current || isAgentSpeakingRef.current || isProcessingRef.current) {
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in window; hardware mic will use MediaRecorder');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = activeBranchRef.current.locale;

      recognition.onstart = () => {
        setIsListening(true);
        setMicErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        // Rebuild the full utterance for this recognition session (finals + live interim)
        let sessionText = '';
        for (let i = 0; i < event.results.length; i++) {
          sessionText += event.results[i][0].transcript + ' ';
        }
        const fullText = `${carriedSpeechRef.current} ${sessionText}`.replace(/\s+/g, ' ').trim();
        if (!fullText) return;

        pendingSpeechRef.current = fullText;
        setInterimTranscript(fullText);
        armSilenceCommit();
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('SpeechRecognition notice:', event.error);
          // If browser restricts Web Speech, hardware MediaRecorder seamlessly captures voice
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Browser ended the session mid-utterance: carry what was heard into the next session
        carriedSpeechRef.current = pendingSpeechRef.current;
        // Automatically restart listening if still in active call and mic enabled
        if (callActiveRef.current && isMicEnabledRef.current && !isAgentSpeakingRef.current && !isProcessingRef.current) {
          setTimeout(() => {
            startLiveSpeechRecognition(true);
          }, 200);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('SpeechRecognition start notice:', err);
    }
  };

  // Hardware MediaRecorder recording & Gemini transcribe fallback
  const startMediaRecording = async () => {
    if (!mediaStreamRef.current) {
      const ok = await initMicrophoneStream();
      if (!ok) return;
    }

    try {
      audioChunksRef.current = [];
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(mediaStreamRef.current!, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecordingMedia(false);
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mime });
          if (blob.size > 400) {
            try {
              setIsProcessing(true);
              const transcript = await aiService.transcribeAudioBlob(blob, activeBranchRef.current.name);
              setIsProcessing(false);
              if (transcript && transcript.trim().length > 0) {
                handleCallerSpokenInput(transcript.trim());
              }
            } catch (err) {
              setIsProcessing(false);
              console.warn('Transcribe error:', err);
            }
          }
        }
      };

      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecordingMedia(true);
    } catch (e) {
      console.warn('MediaRecorder error:', e);
    }
  };

  const stopMediaRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecordingMedia(false);
  };

  // Synchronize speech recognition whenever key call states change
  useEffect(() => {
    if (!callActive) {
      stopLiveSpeechRecognition();
      stopMediaRecording();
      return;
    }

    if (isMicEnabled && !isAgentSpeaking && !isProcessing) {
      startLiveSpeechRecognition();
    } else {
      stopLiveSpeechRecognition();
    }

    return () => {
      stopLiveSpeechRecognition();
    };
  }, [callActive, activeBranch.locale, isMicEnabled, isAgentSpeaking, isProcessing]);

  // Start live helpline call: FIRST request microphone permission, THEN start session
  const handleStartCall = async (preferredKey?: string) => {
    setCallActive(true);
    setPressedKeys([]);
    setInterimTranscript('');
    aiService.stopAudio();

    // 1. FIRST make sure it uses the microphone!
    const micGranted = await initMicrophoneStream();

    const selectedKey = preferredKey || activeIvrKey || getInitialLangKey(currentLanguage);
    setActiveIvrKey(selectedKey);

    const branch = IVR_LANGUAGES[selectedKey] || IVR_LANGUAGES['1'];

    // If caller has chosen a specific regional language (e.g. Tamil '3', Hindi '2', etc.):
    if (selectedKey !== '1') {
      setCurrentPromptStep(2);
      setTranscriptLog([
        {
          speaker: 'Helpline Gateway (1800-11-2529)',
          text: `📞 Connected to PM-AJAY Live Helpline in ${branch.native} (${branch.name}). ${
            micGranted ? '🎙️ Hardware Microphone Connected & Active.' : '⚠️ Microphone ready (tap mic or pills to speak).'
          }\nConnected directly to your regional counselor. Speak anytime or tap voice phrases below!`,
          time: '00:01',
        },
        {
          speaker: `Helpline Agent (${branch.name})`,
          text: branch.agentGreeting,
          time: '00:02',
        },
      ]);

      setIsAgentSpeaking(true);
      aiService.playSpeech(branch.agentGreeting, branch.locale).then(() => {
        setIsAgentSpeaking(false);
        startLiveSpeechRecognition();
      });
    } else {
      setCurrentPromptStep(1);
      const welcomeAnnouncement =
        'Welcome to PM-AJAY National Livelihood Helpline 1800-11-2529. For English press 1. हिन्दी के लिए 2 दबाएं. தமிழுக்கு 3-ஐ அழுத்தவும். తెలుగు కోసం 4 నొక్కండి. ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿರಿ. മലയാളത്തിനായി 6 അമർത്തുക. मराठीसाठी 7 दाबा. বাংলার জন্য 8 টিপুন. ગુજરાતી માટે 9 દબાવો. ਪੰਜਾਬੀ ਲਈ 0 ਦਬਾਓ. ଓଡ଼ିଆ ପାଇଁ ଷ୍ଟାର ଦବାନ୍ତୁ. اردو کے لیے ہیش دبائیں۔';

      setTranscriptLog([
        {
          speaker: 'Helpline Gateway (1800-11-2529)',
          text: `📞 Connected to PM-AJAY National Helpline. ${
            micGranted ? '🎙️ Hardware Microphone Connected & Active.' : '⚠️ Please click the microphone button to enable voice.'
          }\nPress 1 for English • 2 for हिन्दी • 3 for தமிழ் • 4 for తెలుగు • 5 for ಕನ್ನಡ • 6 for മലയാളം • 7 for मराठी • 8 for বাংলা • 9 for ગુજરાતી • 0 for ਪੰਜਾਬੀ • * for ଓଡ଼ିଆ • # for اردو — or speak your preferred language directly!`,
          time: '00:01',
        },
      ]);

      setIsAgentSpeaking(true);
      aiService.playSpeech(welcomeAnnouncement, 'en-IN').then(() => {
        setIsAgentSpeaking(false);
        startLiveSpeechRecognition();
      });
    }
  };

  // Disconnect call and release hardware microphone
  const handleEndCall = () => {
    setCallActive(false);
    setIsListening(false);
    setIsAgentSpeaking(false);
    setIsProcessing(false);
    setInterimTranscript('');
    aiService.stopAudio();
    stopLiveSpeechRecognition();
    stopMediaRecording();
    stopMicrophoneStream();

    setTranscriptLog((prev) => [
      ...prev,
      {
        speaker: 'System',
        text: 'Call disconnected. Thank you for calling PM-AJAY National Livelihood Helpline.',
        time: formatCallTime(callDuration),
      },
    ]);
  };

  // Select language and transition seamlessly to Natural Speaking Agent
  const selectLanguageAndConnectAgent = (langKey: string, pendingQuery?: string) => {
    const branch = IVR_LANGUAGES[langKey] || IVR_LANGUAGES['1'];
    setActiveIvrKey(langKey);
    setCurrentPromptStep(2);
    setInterimTranscript('');
    aiService.stopAudio();
    stopLiveSpeechRecognition();

    setTranscriptLog((prev) => [
      ...prev,
      {
        speaker: 'System Gateway',
        text: `Switched language to ${branch.native} (${branch.name}). Connecting you to Live Helpline Agent...`,
        time: formatCallTime(callDuration),
      },
      {
        speaker: `Helpline Agent (${branch.name})`,
        text: branch.agentGreeting,
        time: formatCallTime(callDuration + 1),
      },
    ]);

    // The caller already said what they want: answer that now instead of reading the greeting
    if (pendingQuery) {
      setTimeout(() => handleCallerSpokenInputRef.current(pendingQuery), 50);
      return;
    }
    setIsAgentSpeaking(true);
    aiService.playSpeech(branch.agentGreeting, branch.locale).then(() => {
      setIsAgentSpeaking(false);
      startLiveSpeechRecognition();
    });
  };

  // Handle DTMF Keypad Presses
  const handleKeyPress = (digit: string) => {
    playDtmfTone(digit);
    setPressedKeys((prev) => [...prev, digit]);

    if (!callActive) return;
    if (ivrApp.handleKey(digit)) return;

    if (currentPromptStep === 1) {
      // Step 1: Language selection
      const key = digit in IVR_LANGUAGES ? digit : '1';
      selectLanguageAndConnectAgent(key);
    } else {
      // Step 2: In-call shortcuts in caller's active language
      if (digit === '*') {
        setCurrentPromptStep(1);
        handleStartCall();
      } else if (digit === '4') {
        aiService.stopAudio();
        ivrApp.begin();
      } else if (digit === '1') {
        const query =
          activeBranch.code === 'ta'
            ? 'PM-AJAY திட்டத்தில் இலவச NSQF பயிற்சி மற்றும் தினசரி படி உதவித்தொகை பற்றி கூறவும்'
            : activeBranch.code === 'hi'
            ? 'PM-AJAY के तहत मुफ्त NSQF कौशल प्रशिक्षण और दैनिक भत्ते की जानकारी दें'
            : activeBranch.code === 'te'
            ? 'PM-AJAY కింద ఉచిత NSQF నైపుణ్య శిక్షణ మరియు రోజువారీ భత్యం వివరాలు చెప్పండి'
            : activeBranch.code === 'kn'
            ? 'PM-AJAY ಅಡಿಯಲ್ಲಿ ಉಚಿತ NSQF ಕೌಶಲ್ಯ ತರಬೇತಿ ಮತ್ತು ಭತ್ಯೆ ಮಾಹಿತಿ ನೀಡಿ'
            : activeBranch.code === 'ml'
            ? 'PM-AJAY പ്രകാരം സൗജന്യ NSQF പരിശീലനവും പ്രതിദിന അലവൻസും വിവരിക്കൂ'
            : 'Tell me about free NSQF skill training and daily stipend under PM-AJAY';
        handleCallerSpokenInput(query);
      } else if (digit === '2') {
        const query =
          activeBranch.code === 'ta'
            ? 'என் கடைக்கு PM-AJAY மூலம் மூலதன மானியம் பெறுவது எப்படி?'
            : activeBranch.code === 'hi'
            ? 'मेरी दुकान के लिए PM-AJAY से पूंजी सब्सिडी कैसे मिलेगी?'
            : activeBranch.code === 'te'
            ? 'నా దుకాణానికి PM-AJAY ద్వారా మూలధన సబ్сиడీ ఎలా పొందాలి?'
            : activeBranch.code === 'kn'
            ? 'ನನ್ನ ಅಂಗಡಿಗೆ PM-AJAY ಮೂಲಕ ಬಂಡವಾಳ ಸಬ್ಸಿಡಿ ಪಡೆಯುವುದು ಹೇಗೆ?'
            : activeBranch.code === 'ml'
            ? 'എന്റെ കടയ്ക്കായി PM-AJAY വഴി മൂലധന സബ്‌സിഡി എങ്ങനെ ലഭിക്കും?'
            : 'How much capital grant subsidy is available under PM-AJAY for my shop?';
        handleCallerSpokenInput(query);
      } else if (digit === '3') {
        const query =
          activeBranch.code === 'ta'
            ? 'எனது தொழில் மற்றும் ஆजीवிகா வழிகாட்டுதல் பற்றி ஆலோசகரிடம் பேச வேண்டும்'
            : activeBranch.code === 'hi'
            ? 'मैं अपने काम और आजीविका रोडमैप पर काउंसलर से बात करना चाहता हूँ'
            : activeBranch.code === 'te'
            ? 'నా వ్యాపారం మరియు జీవనోపాధి రోడ్‌మ్యాప్ గురించి మాట్లాడాలి'
            : activeBranch.code === 'kn'
            ? 'ನನ್ನ ವ್ಯಾಪಾರ ಮತ್ತು ಜೀವನೋಪಾಯ ಮಾರ್ಗಸೂಚಿ ಬಗ್ಗೆ ಮಾತನಾಡಬೇಕು'
            : activeBranch.code === 'ml'
            ? 'എന്റെ തൊഴിലും ഉപജീവന മാർഗ്ഗരേഖയും ചർച്ച ചെയ്യണം'
            : 'I want to speak with the counselor about my trade and livelihood roadmap';
        handleCallerSpokenInput(query);
      } else if (digit === '#') {
        const query =
          activeBranch.code === 'ta'
            ? 'எனக்கான PM-AJAY கௌசல் பத்ரா ரோட்மேப்பை உடனே உருவாக்கவும்'
            : activeBranch.code === 'hi'
            ? 'मेरा PM-AJAY कौशल पत्र रोडमैप अभी तैयार करें'
            : activeBranch.code === 'te'
            ? 'నా PM-AJAY కౌశల్ పత్ర రోడ్‌మ్యాప్ తయారు చేయండి'
            : activeBranch.code === 'kn'
            ? 'ನನ್ನ ಕೌಶಲ್ಯ ಪತ್ರ ರೋಡ್‌ಮ್ಯಾಪ್ ಸಿದ್ಧಪಡಿಸಿ'
            : activeBranch.code === 'ml'
            ? 'എന്റെ കൗശൽ പത്ര റോഡ്‌മാപ്പ് തയാറാക്കൂ'
            : 'Please generate my PM-AJAY Kaushal Patra roadmap now';
        handleCallerSpokenInput(query);
      }
    }
  };

  // Core handler for caller's spoken input (from microphone or quick pills)
  const handleCallerSpokenInput = async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text || !callActive || isProcessing) return;

    // Stop current speech playback when user speaks (Barge-In)
    aiService.stopAudio();
    setIsAgentSpeaking(false);
    stopLiveSpeechRecognition();

    // A form reference, "continue my application", or an answer while an application is open
    if (ivrApp.active || isApplicationRequest(text)) {
      if (currentPromptStep === 1) setCurrentPromptStep(2);
      setTranscriptLog((prev) => [...prev, { speaker: 'Caller (You Spoken)', text: ivrApp.stage === 'pin' ? '••••' : text, time: formatCallTime(callDuration) }]);
      await ivrApp.handleText(text);
      return;
    }

    // 1. If currently in language selection step, detect spoken language
    if (currentPromptStep === 1) {
      const matchedKey = spokenLanguageKey(text);

      if (matchedKey) {
        setTranscriptLog((prev) => [
          ...prev,
          {
            speaker: 'Caller (You Spoken)',
            text: text,
            time: formatCallTime(callDuration),
          },
        ]);
        const hasSubstantialQuery = text.length > 5;
        selectLanguageAndConnectAgent(matchedKey, hasSubstantialQuery ? text : undefined);
        return;
      }
    }

    // 2. Normal Conversation Step
    setTranscriptLog((prev) => [
      ...prev,
      {
        speaker: 'Caller (You Spoken)',
        text: text,
        time: formatCallTime(callDuration),
      },
    ]);

    // Extract profile details on the fly and compute effective profile synchronously
    const extractedUpdates = analyzeAndExtractProfileData(text) || {};
    const effectiveProfile: BeneficiaryProfile = { ...userProfile, ...extractedUpdates };

    // Check if user is asking to create/view roadmap
    const lowerText = text.toLowerCase();
    const isRoadmapRequest =
      lowerText.includes('roadmap') ||
      lowerText.includes('रोडमैप') ||
      lowerText.includes('ரோட்மேப்') ||
      lowerText.includes('రోడ్‌మ్యాప్') ||
      lowerText.includes('ಕೌಶಲ್ಯ ಪತ್ರ') ||
      lowerText.includes('patra') ||
      lowerText.includes('dossier') ||
      lowerText.includes('generate');

    if (isRoadmapRequest) {
      onGenerateRoadmap();
    }

    setIsProcessing(true);

    try {
      // Build conversation messages for AI Counselor
      const messagesForChat = transcriptLog
        .filter((l) => l.speaker.includes('Caller') || l.speaker.includes('Helpline Agent'))
        .slice(-6)
        .map((l) => ({
          role: (l.speaker.includes('Caller') ? 'user' : 'assistant') as 'user' | 'assistant',
          content: l.text,
        }));

      messagesForChat.push({ role: 'user', content: text });

      const reply = await aiService.chatWithAssistant(
        messagesForChat,
        effectiveProfile,
        activeBranch.name,
        'Helpline 1800-11-2529'
      );

      setIsProcessing(false);

      // Log agent response
      setTranscriptLog((prev) => [
        ...prev,
        {
          speaker: `Helpline Agent (${activeBranch.name})`,
          text: reply,
          time: formatCallTime(callDuration + 1),
        },
      ]);

      // Speak in THAT EXACT STUDIO VOICE
      setIsAgentSpeaking(true);
      await aiService.playSpeech(reply, activeBranch.locale);
      setIsAgentSpeaking(false);
      const applyFor = pendingApplyRef.current;
      pendingApplyRef.current = null;
      if (applyFor && callActiveRef.current) {
        await ivrApp.startNew(applyFor);
        return;
      }
      startLiveSpeechRecognition();
    } catch (err) {
      console.error('Agent chat error:', err);
      setIsProcessing(false);

      const lower = text.toLowerCase();
      const fallbackNotice = offlineReply(activeBranch.name, text);

      setTranscriptLog((prev) => [
        ...prev,
        {
          speaker: `Helpline Agent (${activeBranch.name})`,
          text: fallbackNotice,
          time: formatCallTime(callDuration + 1),
        },
      ]);

      setIsAgentSpeaking(true);
      await aiService.playSpeech(fallbackNotice, activeBranch.locale);
      setIsAgentSpeaking(false);
    }
  };
  handleCallerSpokenInputRef.current = handleCallerSpokenInput;

  const toggleMicMute = async () => {
    if (!mediaStreamRef.current) {
      await initMicrophoneStream();
      return;
    }

    if (isMicEnabled) {
      setIsMicEnabled(false);
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    } else {
      setIsMicEnabled(true);
      if (callActive && !isAgentSpeaking && !isProcessing) {
        try {
          recognitionRef.current?.start();
        } catch (e) {}
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6">
      {/* Phone Simulator (Left) */}
      <div className="md:col-span-5 bg-slate-900 rounded-3xl border border-slate-700/80 p-5 shadow-2xl flex flex-col justify-between">
        {/* Screen on Phone */}
        <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 text-center mb-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Radio className="w-3 h-3 animate-pulse" /> VoLTE Live
            </span>
            <span className="text-amber-400 font-bold">PM-AJAY Helpline</span>
          </div>

          <div className="text-2xl font-mono font-black text-amber-300 tracking-wider">
            1800-11-2529
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">National Voice Skilling Gateway (MoSJE)</div>

          {/* Call Status & Live Audio State */}
          <div className="mt-3 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-col gap-1.5 items-center justify-center">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${callActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`}
              />
              <span className={callActive ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                {callActive ? `Active Call (${formatCallTime(callDuration)})` : 'Ready to Dial'}
              </span>
            </div>

            {callActive && (
              <div className="flex items-center gap-2 text-[11px] flex-wrap justify-center">
                {isAgentSpeaking ? (
                  <span className="flex items-center gap-1.5 text-emerald-300 font-semibold animate-pulse">
                    <Volume2 className="w-3.5 h-3.5" /> Agent Speaking...
                  </span>
                ) : isProcessing ? (
                  <span className="flex items-center gap-1.5 text-amber-300 font-semibold animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" /> Agent Thinking...
                  </span>
                ) : isListening ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Mic className="w-3.5 h-3.5 animate-bounce" /> Listening to your voice...
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1">
                    <MicOff className="w-3.5 h-3.5" /> Mic Paused
                  </span>
                )}
                <span className="text-slate-500">•</span>
                <span className="text-amber-300 font-bold">{activeBranch.native}</span>
              </div>
            )}

            {/* Live Hardware Mic Volume Meter */}
            {callActive && isMicEnabled && (
              <div className="w-full mt-1 pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> Mic Input:
                </span>
                <div className="flex items-center gap-1 flex-1 max-w-[140px] h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-75"
                    style={{ width: `${Math.max(5, micVolumeLevel)}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-emerald-400">{micVolumeLevel}%</span>
              </div>
            )}
          </div>

          {/* Error notice if mic was blocked and no hardware mic stream */}
          {micErrorMessage && !mediaStreamRef.current && (
            <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs flex flex-col gap-2 text-left">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span className="font-bold text-amber-300 block mb-0.5">Microphone Status Note:</span>
                  {micErrorMessage}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-500/20">
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shadow-sm transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open in Full Tab for Direct Mic ↗</span>
                </a>
                <button
                  onClick={initMicrophoneStream}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 text-[10px] transition"
                >
                  Retry Mic
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/40 text-[10px] flex items-center gap-1 transition"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Audio</span>
                </button>
              </div>
            </div>
          )}

          {/* Connected hardware mic badge */}
          {callActive && mediaStreamRef.current && (
            <div className="mt-1.5 py-1 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Hardware Mic Live & Connected</span>
              </span>
              <span className="text-[9px] text-emerald-400/80 font-mono">
                {isRecordingMedia ? '🔴 Recording voice...' : 'Listening'}
              </span>
            </div>
          )}

          {pressedKeys.length > 0 && (
            <div className="mt-2 text-[10px] font-mono text-amber-400/80">
              Keys: {pressedKeys.join(' → ')}
            </div>
          )}
        </div>

        {/* Live Voice Controls & Prominent Push-to-Talk Mic */}
        {callActive && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isRecordingMedia) {
                    stopMediaRecording();
                  } else {
                    startMediaRecording();
                    startLiveSpeechRecognition();
                  }
                }}
                className={`flex-1 py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition shadow-md ${
                  isRecordingMedia
                    ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30'
                    : isListening
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Mic className={`w-4 h-4 ${isRecordingMedia || isListening ? 'animate-bounce text-emerald-300' : 'text-slate-400'}`} />
                <span>
                  {isRecordingMedia
                    ? 'Recording voice... Click to send'
                    : isListening
                    ? '🎙️ Mic Listening — Speak Now'
                    : '🎙️ Tap to Speak (Use Mic)'}
                </span>
              </button>

              <button
                onClick={toggleMicMute}
                title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                className={`p-2.5 rounded-2xl border transition ${
                  isMicEnabled
                    ? 'bg-slate-800 border-slate-700 text-emerald-400'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}
              >
                {isMicEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-rose-400" />}
              </button>

              <button
                onClick={() => {
                  aiService.stopAudio();
                  setIsAgentSpeaking(false);
                }}
                title="Stop current agent speech"
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                <VolumeX className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Language Pills (Available in both Step 1 & Step 2 for instant switching) */}
            <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-amber-500/40">
              <div className="text-[10px] font-bold text-amber-300 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> {currentPromptStep === 1 ? 'Choose Language / மொழி தேர்வு:' : `Language: ${activeBranch.native} • Switch:`}
                </span>
                <span className="text-[9px] text-slate-400">Speak or Tap</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                {[
                  { key: '1', label: '1. English', code: 'en' },
                  { key: '2', label: '2. हिन्दी', code: 'hi' },
                  { key: '3', label: '3. தமிழ்', code: 'ta' },
                  { key: '4', label: '4. తెలుగు', code: 'te' },
                  { key: '5', label: '5. ಕನ್ನಡ', code: 'kn' },
                  { key: '6', label: '6. മലയാളം', code: 'ml' },
                  { key: '7', label: '7. मराठी', code: 'mr' },
                  { key: '8', label: '8. বাংলা', code: 'bn' },
                  { key: '9', label: '9. ગુજરાતી', code: 'gu' },
                  { key: '0', label: '0. ਪੰਜਾਬੀ', code: 'pa' },
                  { key: '*', label: '*. ଓଡ଼ିଆ', code: 'or' },
                  { key: '#', label: '#. اردو', code: 'ur' },
                ].map((l) => (
                  <button
                    key={l.key}
                    onClick={() => selectLanguageAndConnectAgent(l.key)}
                    className={`py-1 px-1.5 rounded-xl font-bold border transition text-center ${
                      activeIvrKey === l.key
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                        : l.key === '3'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 hover:bg-amber-500/25'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dialpad Grid (Direct languages & service options) */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { num: '1', sub: currentPromptStep === 1 ? 'English' : 'NSQF' },
            { num: '2', sub: currentPromptStep === 1 ? 'हिन्दी' : 'Grants' },
            { num: '3', sub: currentPromptStep === 1 ? 'தமிழ்' : 'Counselor' },
            { num: '4', sub: currentPromptStep === 1 ? 'తెలుగు' : 'My form' },
            { num: '5', sub: currentPromptStep === 1 ? 'ಕನ್ನಡ' : 'Stipend' },
            { num: '6', sub: currentPromptStep === 1 ? 'മലയാളം' : 'Self-Emp' },
            { num: '7', sub: 'PQRS' },
            { num: '8', sub: 'TUV' },
            { num: '9', sub: 'WXYZ' },
            { num: '*', sub: 'Lang Reset' },
            { num: '0', sub: 'Operator' },
            { num: '#', sub: 'Roadmap' },
          ].map((k) => (
            <button
              key={k.num}
              onClick={() => handleKeyPress(k.num)}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-bold transition flex flex-col items-center justify-center border border-slate-700 shadow-sm"
            >
              <span className="text-lg leading-none">{k.num}</span>
              <span className="text-[9px] text-amber-300/90 font-medium mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]">
                {k.sub}
              </span>
            </button>
          ))}
        </div>

        {/* Call Action Bar */}
        <div className="mt-3.5 space-y-2">
          {!callActive ? (
            <>
              {/* Pre-Call Microphone Check & Test Button */}
              <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${hasMicPermission ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <div>
                    <div className="font-bold text-white text-[11px]">
                      {hasMicPermission ? '🎙️ Microphone Connected' : '🎙️ Microphone Ready'}
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {hasMicPermission ? 'Ready for live voice conversation' : 'Click to test before dialing'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={initMicrophoneStream}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-[10px] border border-slate-700 flex items-center gap-1 transition"
                >
                  <Mic className="w-3 h-3 text-amber-400" />
                  <span>{hasMicPermission ? 'Test Voice' : 'Connect Mic'}</span>
                </button>
              </div>

              {/* Direct Dial Buttons */}
              <button
                onClick={() => handleStartCall()}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition transform active:scale-95"
              >
                <PhoneCall className="w-4 h-4" />
                <span>
                  {activeBranch.code === 'ta'
                    ? 'Dial 1800-11-2529 (நேரடி உதவி மையம் - தமிழ்)'
                    : activeBranch.code === 'hi'
                    ? 'Dial 1800-11-2529 (लाइव हेल्पलाइन - हिन्दी)'
                    : `Dial 1800-11-2529 (${activeBranch.name} Speaking Agent)`}
                </span>
              </button>

              {/* Quick Dial in specific languages */}
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button
                  onClick={() => handleStartCall('3')}
                  className="py-1.5 px-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold text-center transition"
                >
                  Dial தமிழ் (3)
                </button>
                <button
                  onClick={() => handleStartCall('2')}
                  className="py-1.5 px-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-center transition"
                >
                  Dial हिन्दी (2)
                </button>
                <button
                  onClick={() => handleStartCall('1')}
                  className="py-1.5 px-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-center transition"
                >
                  Dial English (1)
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
                <span>🎙️ Natural Voice Agent</span>
                <span className="text-emerald-400 font-medium">Barge-In Enabled</span>
              </div>
            </>
          ) : (
            <button
              onClick={handleEndCall}
              className="w-full py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition transform active:scale-95"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Disconnect Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time Call Transcript & Live Voice Interaction (Right) */}
      <div className="md:col-span-7 bg-slate-900 rounded-3xl border border-slate-700/80 p-5 shadow-2xl flex flex-col h-[700px]">
        {/* Top Header */}
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="font-bold text-sm text-white">Live Helpline Audio Conversation</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
              {activeBranch.native} ({activeBranch.name})
            </span>
          </div>
        </div>

        {/* Live Conversation Transcript */}
        <div className="flex-1 overflow-y-auto py-3.5 space-y-3">
          {transcriptLog.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <PhoneCall className="w-12 h-12 text-slate-700 mb-3" />
              <p className="font-semibold text-slate-300 text-sm">
                Press "Dial 1800-11-2529" to connect with the live helpline speaking agent.
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Microphone will be activated automatically. You can speak naturally in English, हिन्दी, தமிழ், తెలుగు, ಕನ್ನಡ, or മലയാളം!
              </p>
            </div>
          ) : (
            <>
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition ${
                    isAgentSpeaking
                      ? 'bg-emerald-500/20 border-emerald-400 animate-pulse'
                      : isProcessing
                      ? 'bg-amber-500/15 border-amber-400'
                      : callActive && interimTranscript
                      ? 'bg-sky-500/20 border-sky-400 animate-pulse'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  {isProcessing ? (
                    <Sparkles className="w-10 h-10 text-amber-400 animate-spin" />
                  ) : isAgentSpeaking ? (
                    <Bot className="w-10 h-10 text-emerald-400" />
                  ) : callActive ? (
                    <Mic className="w-10 h-10 text-sky-400" />
                  ) : (
                    <PhoneCall className="w-10 h-10 text-slate-500" />
                  )}
                </div>
                <p className="mt-4 font-semibold text-slate-200 text-sm">
                  {!callActive
                    ? 'Call ended'
                    : isProcessing
                    ? 'Agent is thinking…'
                    : isAgentSpeaking
                    ? 'Agent is speaking…'
                    : interimTranscript
                    ? 'Listening — take your time…'
                    : 'Your turn — speak anytime'}
                </p>
                {/* The last few turns, so the caller can see the question being asked */}
                <ol className="mt-4 w-full max-w-lg space-y-1.5 text-left" aria-label="Recent conversation">
                  {transcriptLog.slice(-4).map((l, i) => (
                    <li
                      key={`${transcriptLog.length}-${i}`}
                      className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        l.speaker.startsWith('Caller') ? 'ml-8 bg-sky-500/15 text-sky-100' : 'mr-8 bg-slate-800 text-slate-200'
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{l.speaker}</span>
                      <span className="line-clamp-4" translate={l.speaker.startsWith('Caller') ? 'no' : undefined}>{l.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div ref={logEndRef} />
            </>
          )}
        </div>

        {/* One-Tap Voice Chips (Immediate on-spot voice tests in selected language) */}
        {callActive && (
          <div className="pt-2.5 pb-2 border-t border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Mic className="w-3 h-3 text-emerald-400" /> Speak on the spot (Click to speak query to Agent):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activeBranch.sampleVoicePills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCallerSpokenInput(pill)}
                  disabled={isProcessing}
                  className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 text-slate-300 text-[11px] border border-slate-700/80 transition flex items-center gap-1 text-left"
                >
                  <MessageSquare className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate max-w-[260px]">"{pill}"</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice & Text Input Box */}
        {callActive && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            {interimTranscript && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300 flex-1">
                  <Mic className="w-4 h-4 text-emerald-400 flex-shrink-0 animate-pulse" />
                  <span className="font-semibold text-emerald-400">Listening — take your time…</span>
                </div>
                <button
                  onClick={() => {
                    if (silenceTimeoutRef.current) {
                      clearTimeout(silenceTimeoutRef.current);
                      silenceTimeoutRef.current = null;
                    }
                    commitPendingSpeech();
                  }}
                  className="ml-2 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex-shrink-0"
                >
                  Done Speaking
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isRecordingMedia) {
                    stopMediaRecording();
                  } else {
                    startMediaRecording();
                    startLiveSpeechRecognition();
                  }
                }}
                className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition ${
                  isRecordingMedia
                    ? 'bg-rose-500 text-white animate-pulse'
                    : isListening
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Tap to speak with live microphone"
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">{isRecordingMedia ? 'Recording...' : 'Speak'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleAudioFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload audio clip or voice note"
                className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1 transition"
              >
                <Upload className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Upload Audio</span>
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  value={customInputText}
                  onChange={(e) => setCustomInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customInputText.trim()) {
                      handleCallerSpokenInput(customInputText);
                      setCustomInputText('');
                    }
                  }}
                  placeholder={`Speak into mic or type in ${activeBranch.name}...`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 pr-10"
                />
                <button
                  onClick={() => {
                    if (customInputText.trim()) {
                      handleCallerSpokenInput(customInputText);
                      setCustomInputText('');
                    }
                  }}
                  disabled={!customInputText.trim() || isProcessing}
                  className="absolute right-1.5 top-1.5 p-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Summary & Roadmap Trigger */}
        <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Caller: <strong>{userProfile.name || 'Anonymous Caller'}</strong>
              {userProfile.district ? ` • ${userProfile.district}` : ''}
              {userProfile.traditionalTrade ? ` • ${userProfile.traditionalTrade}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onGenerateRoadmap();
                onOpenKaushalPatra();
              }}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{roadmap ? 'View Kaushal Patra' : 'Generate Roadmap'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
