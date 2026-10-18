import { LanguageCode } from '../types';

export interface ShellStrings {
  nav: { home: string; schemes: string; skills: string; enterprise: string; applications: string; apply: string; assistant: string; more: string };
  hero: { eyebrow: string; title: string; subtitle: string; speakCta: string; exploreCta: string; capabilities: [string, string, string] };
  help: { title: string; scheme: string; document: string; business: string; jobs: string; eligibility: string; apply: string };
  orb: { idle: string; listening: string; processing: string; speaking: string; paused: string };
  suggestions: string[];
  signIn: string;
  profile: string;
  language: string;
  accessibility: string;
}

const en: ShellStrings = {
  nav: {
    home: 'Home',
    schemes: 'Explore Schemes',
    skills: 'Skills & Opportunities',
    enterprise: 'Start a business',
    applications: 'My Applications',
    apply: 'Smart Apply',
    assistant: 'Talk to UDAAN AI',
    more: 'Access modes',
  },
  hero: {
    eyebrow: 'AI for Opportunity. Technology for All.',
    title: 'Your next opportunity starts here.',
    subtitle:
      "Discover the support you qualify for, understand your options, and prepare applications with AI assistance — in a language you're comfortable with.",
    speakCta: 'Talk to UDAAN AI',
    exploreCta: 'Find my opportunities',
    capabilities: ['Discover', 'Understand', 'Apply'],
  },
  help: {
    title: 'What would you like help with today?',
    scheme: 'Find a government scheme',
    document: 'Get a document or certificate',
    business: 'Start a business',
    jobs: 'Find training or employment',
    eligibility: 'Check my eligibility',
    apply: 'Help me fill an application',
  },
  orb: { idle: 'Tap to speak', listening: 'Listening — take your time', processing: 'Thinking…', speaking: 'Speaking…', paused: 'Paused' },
  suggestions: [
    'Find schemes I am eligible for.',
    'I want to start a small business.',
    'Help me find skill training.',
    'How do I apply for financial assistance?',
  ],
  signIn: 'Sign in',
  profile: 'My profile',
  language: 'Language',
  accessibility: 'Accessibility',
};

const hi: ShellStrings = {
  nav: {
    home: 'होम',
    schemes: 'योजनाएँ देखें',
    skills: 'कौशल और अवसर',
    enterprise: 'व्यवसाय शुरू करें',
    applications: 'मेरे आवेदन',
    apply: 'स्मार्ट आवेदन',
    assistant: 'UDAAN AI से बात करें',
    more: 'अन्य माध्यम',
  },
  hero: {
    eyebrow: 'अवसर के लिए AI। सबके लिए तकनीक।',
    title: 'आपका अगला अवसर यहीं से शुरू होता है।',
    subtitle: 'जानिए आप किस सहायता के पात्र हो सकते हैं, अपने विकल्प समझिए, और AI की मदद से आवेदन तैयार कीजिए — उस भाषा में जिसमें आप सहज हैं।',
    speakCta: 'UDAAN AI से बात करें',
    exploreCta: 'मेरे अवसर खोजें',
    capabilities: ['खोजें', 'समझें', 'आवेदन करें'],
  },
  help: {
    title: 'आज आपको किस काम में मदद चाहिए?',
    scheme: 'सरकारी योजना खोजें',
    document: 'दस्तावेज़ या प्रमाण पत्र बनवाएँ',
    business: 'व्यवसाय शुरू करें',
    jobs: 'प्रशिक्षण या रोज़गार खोजें',
    eligibility: 'मेरी पात्रता जाँचें',
    apply: 'आवेदन भरने में मदद करें',
  },
  orb: { idle: 'बोलने के लिए दबाएँ', listening: 'सुन रहा हूँ — आराम से बोलिए', processing: 'सोच रहा हूँ…', speaking: 'बोल रहा हूँ…', paused: 'रुका हुआ' },
  suggestions: ['मेरे लिए कौन-सी योजनाएँ हैं?', 'मैं छोटा व्यवसाय शुरू करना चाहता हूँ।', 'कौशल प्रशिक्षण खोजने में मदद करें।', 'आर्थिक सहायता के लिए आवेदन कैसे करें?'],
  signIn: 'साइन इन',
  profile: 'मेरी प्रोफ़ाइल',
  language: 'भाषा',
  accessibility: 'सुगम्यता',
};

const ta: ShellStrings = {
  nav: {
    home: 'முகப்பு',
    schemes: 'திட்டங்கள்',
    skills: 'திறன் & வாய்ப்புகள்',
    enterprise: 'தொழில் தொடங்க',
    applications: 'என் விண்ணப்பங்கள்',
    apply: 'ஸ்மார்ட் விண்ணப்பம்',
    assistant: 'UDAAN AI உடன் பேசுங்கள்',
    more: 'பிற வழிகள்',
  },
  hero: {
    eyebrow: 'வாய்ப்புக்கான AI. அனைவருக்குமான தொழில்நுட்பம்.',
    title: 'உங்கள் அடுத்த வாய்ப்பு இங்கே தொடங்குகிறது.',
    subtitle: 'உங்களுக்குக் கிடைக்கக்கூடிய உதவிகளைக் கண்டறிந்து, உங்கள் வாய்ப்புகளைப் புரிந்துகொண்டு, AI உதவியுடன் விண்ணப்பங்களைத் தயார் செய்யுங்கள் — உங்களுக்கு வசதியான மொழியில்.',
    speakCta: 'UDAAN AI உடன் பேசுங்கள்',
    exploreCta: 'என் வாய்ப்புகளைக் கண்டறி',
    capabilities: ['கண்டறி', 'புரிந்துகொள்', 'விண்ணப்பி'],
  },
  help: {
    title: 'இன்று உங்களுக்கு எதில் உதவி வேண்டும்?',
    scheme: 'அரசு திட்டத்தைக் கண்டறி',
    document: 'ஆவணம் அல்லது சான்றிதழ் பெற',
    business: 'தொழில் தொடங்க',
    jobs: 'பயிற்சி அல்லது வேலை தேட',
    eligibility: 'என் தகுதியைச் சரிபார்',
    apply: 'விண்ணப்பம் நிரப்ப உதவு',
  },
  orb: { idle: 'பேச அழுத்தவும்', listening: 'கேட்கிறேன் — நிதானமாகப் பேசுங்கள்', processing: 'யோசிக்கிறேன்…', speaking: 'பேசுகிறேன்…', paused: 'இடைநிறுத்தம்' },
  suggestions: ['எனக்கு தகுதியான திட்டங்கள் எவை?', 'நான் சிறு தொழில் தொடங்க விரும்புகிறேன்.', 'திறன் பயிற்சி கண்டறிய உதவுங்கள்.', 'நிதி உதவிக்கு எப்படி விண்ணப்பிப்பது?'],
  signIn: 'உள்நுழை',
  profile: 'என் விவரம்',
  language: 'மொழி',
  accessibility: 'அணுகல்தன்மை',
};

const te: ShellStrings = {
  nav: {
    home: 'హోమ్',
    schemes: 'పథకాలు',
    skills: 'నైపుణ్యాలు & అవకాశాలు',
    enterprise: 'వ్యాపారం ప్రారంభించండి',
    applications: 'నా దరఖాస్తులు',
    apply: 'స్మార్ట్ దరఖాస్తు',
    assistant: 'UDAAN AI తో మాట్లాడండి',
    more: 'ఇతర మార్గాలు',
  },
  hero: {
    eyebrow: 'అవకాశాల కోసం AI. అందరి కోసం సాంకేతికత.',
    title: 'మీ తదుపరి అవకాశం ఇక్కడే మొదలవుతుంది.',
    subtitle: 'మీకు అందే సహాయాన్ని తెలుసుకోండి, మీ అవకాశాలను అర్థం చేసుకోండి, AI సహాయంతో దరఖాస్తులు సిద్ధం చేసుకోండి — మీకు సౌకర్యంగా ఉన్న భాషలో.',
    speakCta: 'UDAAN AI తో మాట్లాడండి',
    exploreCta: 'నా అవకాశాలు కనుగొనండి',
    capabilities: ['కనుగొనండి', 'అర్థం చేసుకోండి', 'దరఖాస్తు చేయండి'],
  },
  help: {
    title: 'ఈ రోజు మీకు ఏ విషయంలో సహాయం కావాలి?',
    scheme: 'ప్రభుత్వ పథకం కనుగొనండి',
    document: 'పత్రం లేదా ధృవీకరణ పత్రం పొందండి',
    business: 'వ్యాపారం ప్రారంభించండి',
    jobs: 'శిక్షణ లేదా ఉద్యోగం కనుగొనండి',
    eligibility: 'నా అర్హత తనిఖీ చేయండి',
    apply: 'దరఖాస్తు నింపడంలో సహాయం',
  },
  orb: { idle: 'మాట్లాడటానికి నొక్కండి', listening: 'వింటున్నాను — నెమ్మదిగా మాట్లాడండి', processing: 'ఆలోచిస్తున్నాను…', speaking: 'మాట్లాడుతున్నాను…', paused: 'ఆపబడింది' },
  suggestions: ['నాకు అర్హత ఉన్న పథకాలు ఏవి?', 'నేను చిన్న వ్యాపారం ప్రారంభించాలనుకుంటున్నాను.', 'నైపుణ్య శిక్షణ కనుగొనడంలో సహాయం చేయండి.', 'ఆర్థిక సహాయానికి ఎలా దరఖాస్తు చేయాలి?'],
  signIn: 'సైన్ ఇన్',
  profile: 'నా ప్రొఫైల్',
  language: 'భాష',
  accessibility: 'యాక్సెసిబిలిటీ',
};

const kn: ShellStrings = {
  nav: {
    home: 'ಮುಖಪುಟ',
    schemes: 'ಯೋಜನೆಗಳು',
    skills: 'ಕೌಶಲ್ಯ & ಅವಕಾಶಗಳು',
    enterprise: 'ವ್ಯಾಪಾರ ಆರಂಭಿಸಿ',
    applications: 'ನನ್ನ ಅರ್ಜಿಗಳು',
    apply: 'ಸ್ಮಾರ್ಟ್ ಅರ್ಜಿ',
    assistant: 'UDAAN AI ಜೊತೆ ಮಾತನಾಡಿ',
    more: 'ಇತರ ಮಾರ್ಗಗಳು',
  },
  hero: {
    eyebrow: 'ಅವಕಾಶಕ್ಕಾಗಿ AI. ಎಲ್ಲರಿಗಾಗಿ ತಂತ್ರಜ್ಞಾನ.',
    title: 'ನಿಮ್ಮ ಮುಂದಿನ ಅವಕಾಶ ಇಲ್ಲಿಂದ ಆರಂಭವಾಗುತ್ತದೆ.',
    subtitle: 'ನಿಮಗೆ ಸಿಗಬಹುದಾದ ನೆರವನ್ನು ತಿಳಿಯಿರಿ, ನಿಮ್ಮ ಆಯ್ಕೆಗಳನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ, AI ನೆರವಿನಿಂದ ಅರ್ಜಿಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಿ — ನಿಮಗೆ ಅನುಕೂಲವಾದ ಭಾಷೆಯಲ್ಲಿ.',
    speakCta: 'UDAAN AI ಜೊತೆ ಮಾತನಾಡಿ',
    exploreCta: 'ನನ್ನ ಅವಕಾಶಗಳನ್ನು ಹುಡುಕಿ',
    capabilities: ['ಹುಡುಕಿ', 'ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ', 'ಅರ್ಜಿ ಹಾಕಿ'],
  },
  help: {
    title: 'ಇಂದು ನಿಮಗೆ ಯಾವುದರಲ್ಲಿ ಸಹಾಯ ಬೇಕು?',
    scheme: 'ಸರ್ಕಾರಿ ಯೋಜನೆ ಹುಡುಕಿ',
    document: 'ದಾಖಲೆ ಅಥವಾ ಪ್ರಮಾಣಪತ್ರ ಪಡೆಯಿರಿ',
    business: 'ವ್ಯಾಪಾರ ಆರಂಭಿಸಿ',
    jobs: 'ತರಬೇತಿ ಅಥವಾ ಉದ್ಯೋಗ ಹುಡುಕಿ',
    eligibility: 'ನನ್ನ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ',
    apply: 'ಅರ್ಜಿ ತುಂಬಲು ಸಹಾಯ ಮಾಡಿ',
  },
  orb: { idle: 'ಮಾತನಾಡಲು ಒತ್ತಿರಿ', listening: 'ಕೇಳುತ್ತಿದ್ದೇನೆ — ನಿಧಾನವಾಗಿ ಮಾತನಾಡಿ', processing: 'ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…', speaking: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ…', paused: 'ವಿರಾಮ' },
  suggestions: ['ನನಗೆ ಅರ್ಹವಾದ ಯೋಜನೆಗಳು ಯಾವುವು?', 'ನಾನು ಸಣ್ಣ ವ್ಯಾಪಾರ ಆರಂಭಿಸಲು ಬಯಸುತ್ತೇನೆ.', 'ಕೌಶಲ್ಯ ತರಬೇತಿ ಹುಡುಕಲು ಸಹಾಯ ಮಾಡಿ.', 'ಆರ್ಥಿಕ ನೆರವಿಗೆ ಹೇಗೆ ಅರ್ಜಿ ಹಾಕುವುದು?'],
  signIn: 'ಸೈನ್ ಇನ್',
  profile: 'ನನ್ನ ಪ್ರೊಫೈಲ್',
  language: 'ಭಾಷೆ',
  accessibility: 'ಪ್ರವೇಶಸಾಧ್ಯತೆ',
};

const ml: ShellStrings = {
  nav: {
    home: 'ഹോം',
    schemes: 'പദ്ധതികൾ',
    skills: 'നൈപുണ്യം & അവസരങ്ങൾ',
    enterprise: 'ബിസിനസ് തുടങ്ങാം',
    applications: 'എന്റെ അപേക്ഷകൾ',
    apply: 'സ്മാർട്ട് അപേക്ഷ',
    assistant: 'UDAAN AI-യോട് സംസാരിക്കൂ',
    more: 'മറ്റ് മാർഗങ്ങൾ',
  },
  hero: {
    eyebrow: 'അവസരത്തിനായി AI. എല്ലാവർക്കും സാങ്കേതികവിദ്യ.',
    title: 'നിങ്ങളുടെ അടുത്ത അവസരം ഇവിടെ തുടങ്ങുന്നു.',
    subtitle: 'നിങ്ങൾക്ക് ലഭിക്കാവുന്ന സഹായങ്ങൾ കണ്ടെത്തൂ, നിങ്ങളുടെ സാധ്യതകൾ മനസ്സിലാക്കൂ, AI സഹായത്തോടെ അപേക്ഷകൾ തയ്യാറാക്കൂ — നിങ്ങൾക്ക് സൗകര്യമുള്ള ഭാഷയിൽ.',
    speakCta: 'UDAAN AI-യോട് സംസാരിക്കൂ',
    exploreCta: 'എന്റെ അവസരങ്ങൾ കണ്ടെത്തൂ',
    capabilities: ['കണ്ടെത്തൂ', 'മനസ്സിലാക്കൂ', 'അപേക്ഷിക്കൂ'],
  },
  help: {
    title: 'ഇന്ന് നിങ്ങൾക്ക് എന്തിനാണ് സഹായം വേണ്ടത്?',
    scheme: 'സർക്കാർ പദ്ധതി കണ്ടെത്തൂ',
    document: 'രേഖയോ സർട്ടിഫിക്കറ്റോ നേടൂ',
    business: 'ബിസിനസ് തുടങ്ങാം',
    jobs: 'പരിശീലനമോ ജോലിയോ കണ്ടെത്തൂ',
    eligibility: 'എന്റെ യോഗ്യത പരിശോധിക്കൂ',
    apply: 'അപേക്ഷ പൂരിപ്പിക്കാൻ സഹായിക്കൂ',
  },
  orb: { idle: 'സംസാരിക്കാൻ അമർത്തുക', listening: 'കേൾക്കുന്നു — സാവധാനം സംസാരിക്കൂ', processing: 'ആലോചിക്കുന്നു…', speaking: 'സംസാരിക്കുന്നു…', paused: 'നിർത്തിവച്ചു' },
  suggestions: ['എനിക്ക് അർഹതയുള്ള പദ്ധതികൾ ഏതൊക്കെ?', 'എനിക്ക് ഒരു ചെറിയ ബിസിനസ് തുടങ്ങണം.', 'നൈപുണ്യ പരിശീലനം കണ്ടെത്താൻ സഹായിക്കൂ.', 'സാമ്പത്തിക സഹായത്തിന് എങ്ങനെ അപേക്ഷിക്കാം?'],
  signIn: 'സൈൻ ഇൻ',
  profile: 'എന്റെ പ്രൊഫൈൽ',
  language: 'ഭാഷ',
  accessibility: 'പ്രവേശനക്ഷമത',
};

const STRINGS: Partial<Record<LanguageCode, ShellStrings>> = { en, hi, ta, te, kn, ml };

export const getShellStrings = (lang: LanguageCode): ShellStrings => STRINGS[lang] || en;
