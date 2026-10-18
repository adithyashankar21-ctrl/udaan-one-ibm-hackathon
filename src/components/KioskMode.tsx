import React, { useState } from 'react';
import { 
  Volume2, 
  Sparkles, 
  Award, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Zap, 
  Wrench, 
  Layers, 
  Smartphone,
  ChevronRight
} from 'lucide-react';
import { BeneficiaryProfile, LanguageCode, LivelihoodAnalysis } from '../types';
import { SUPPORTED_LANGUAGES, UI_TRANSLATIONS } from '../data/languages';
import { aiService } from '../services/aiService';

interface KioskModeProps {
  currentLanguage: LanguageCode;
  userProfile: BeneficiaryProfile;
  onUpdateProfile: (profile: Partial<BeneficiaryProfile>) => void;
  onGenerateRoadmap: () => void;
  isGeneratingRoadmap: boolean;
  roadmap: LivelihoodAnalysis | null;
  onOpenKaushalPatra: () => void;
}

export const KioskMode: React.FC<KioskModeProps> = ({
  currentLanguage,
  userProfile,
  onUpdateProfile,
  onGenerateRoadmap,
  isGeneratingRoadmap,
  roadmap,
  onOpenKaushalPatra,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const ui = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const speakPrompt = (text: string) => {
    aiService.playSpeech(text, langConfig.speechLocale);
  };

  // Localized trade cards
  const tradeCardsByLang: Record<string, Array<{
    id: string;
    title: string;
    sub: string;
    icon: string;
    trade: string;
    skills: string;
  }>> = {
    ta: [
      { id: 'stitching', title: 'தையல் & ஆடை தயாரிப்பு', sub: 'Garment & Sewing Machine', icon: '🧵', trade: 'Tailoring & Garments', skills: 'Machine stitching, pattern cutting' },
      { id: 'leather', title: 'தோல் & காலணி வேலை', sub: 'Leather Footwear & Crafts', icon: '👞', trade: 'Leather Footwear & Goods', skills: 'Leather cutting, shoe lasting' },
      { id: 'solar', title: 'சூரிய சக்தி (சூர்யமித்ரா)', sub: 'Solar PV Tech & Electrician', icon: '☀️', trade: 'Solar Energy & Electrician', skills: 'Solar rooftop, inverter installation' },
      { id: 'auto', title: 'இருசக்கர வாகன பழுது', sub: 'Two-Wheeler & EV Mechanic', icon: '🛵', trade: 'Two Wheeler Servicing', skills: 'EV scooter repair, engine overhaul' },
      { id: 'dairy', title: 'பால் பண்ணை & கால்நடை', sub: 'Dairy Farming & Livestock', icon: '🐄', trade: 'Dairy & Animal Husbandry', skills: 'Milking, cattle nutrition' },
      { id: 'mason', title: 'கட்டட வேலை & கொத்தனார்', sub: 'Masonry & Construction', icon: '🧱', trade: 'Construction & Masonry', skills: 'Brick laying, tile fitting' },
      { id: 'digital', title: 'கணினி & தரவு உள்ளீடு', sub: 'CSC Digital Facilitator', icon: '💻', trade: 'Domestic Data Entry', skills: 'Computer typing, online forms' },
      { id: 'handloom', title: 'கைத்தறி & கைவினை', sub: 'Handloom & Handicrafts', icon: '🎨', trade: 'Handloom Weaver', skills: 'Weaving, yarn processing' },
    ],
    te: [
      { id: 'stitching', title: 'టైలరింగ్ & దుస్తుల తయారీ', sub: 'Garment & Sewing Machine', icon: '🧵', trade: 'Tailoring & Garments', skills: 'Machine stitching, design' },
      { id: 'leather', title: 'లెదర్ & పాదరక్షల పని', sub: 'Leather Goods & Footwear', icon: '👞', trade: 'Leather Footwear & Goods', skills: 'Leather cutting, lasting' },
      { id: 'solar', title: 'సోలార్ టెక్నాలజీ (సూర్యమిత్ర)', sub: 'Solar PV Tech & Electrician', icon: '☀️', trade: 'Solar Energy & Electrician', skills: 'Panel installation, wiring' },
      { id: 'auto', title: 'బైక్ & ఈవీ మెకానిక్', sub: 'Two-Wheeler & EV Servicing', icon: '🛵', trade: 'Two Wheeler Servicing', skills: 'EV motor repair, bike service' },
      { id: 'dairy', title: 'పాడి పరిశ్రమ & పశుపోషణ', sub: 'Dairy & Livestock Farming', icon: '🐄', trade: 'Dairy & Animal Husbandry', skills: 'Milk handling, cattle management' },
      { id: 'mason', title: 'మేస్త్రీ & నిర్మాణ పని', sub: 'Masonry & Tile Laying', icon: '🧱', trade: 'Construction & Masonry', skills: 'Brickwork, plastering' },
      { id: 'digital', title: 'కంప్యూటర్ & డాటా ఎంట్రీ', sub: 'CSC Digital Facilitator', icon: '💻', trade: 'Domestic Data Entry', skills: 'Online portals, typing' },
      { id: 'handloom', title: 'చేనేత వస్త్రాలు & హస్తకళలు', sub: 'Handloom & Handicrafts', icon: '🎨', trade: 'Handloom Weaver', skills: 'Loom weaving, zari craft' },
    ],
    kn: [
      { id: 'stitching', title: 'ಟೈಲರಿಂಗ್ ಮತ್ತು ಗಾರ್ಮೆಂಟ್ಸ್', sub: 'Garment & Sewing Tech', icon: '🧵', trade: 'Tailoring & Garments', skills: 'Machine stitching, garment cutting' },
      { id: 'leather', title: 'ಚರ್ಮ ಮತ್ತು ಪಾದರಕ್ಷೆ ತಯಾರಿಕೆ', sub: 'Leather Goods & Chappals', icon: '👞', trade: 'Leather Footwear & Goods', skills: 'Leather craft, sole making' },
      { id: 'solar', title: 'ಸೋಲಾರ್ ಸೂರ್ಯಮಿತ್ರ & ವಿದ್ಯುತ್', sub: 'Solar PV & Electrician', icon: '☀️', trade: 'Solar Energy & Electrician', skills: 'Wiring, solar rooftop installation' },
      { id: 'auto', title: 'ಬೈಕ್ ಮತ್ತು ಇವಿ ಮೆಕ್ಯಾನಿಕ್', sub: 'Two-Wheeler & EV Servicing', icon: '🛵', trade: 'Two Wheeler Servicing', skills: 'EV battery & motor overhaul' },
      { id: 'dairy', title: 'ಡೈರಿ ಮತ್ತು ಹೈನುಗಾರಿಕೆ', sub: 'Dairy & Livestock Farming', icon: '🐄', trade: 'Dairy & Animal Husbandry', skills: 'Milking, cattle nutrition' },
      { id: 'mason', title: 'ಕಟ್ಟಡ ನಿರ್ಮಾಣ & ಮೇಸ್ತ್ರಿ', sub: 'Masonry & Construction', icon: '🧱', trade: 'Construction & Masonry', skills: 'Brickwork, tiling' },
      { id: 'digital', title: 'ಕಂಪ್ಯೂಟರ್ & ಡಿಜಿಟಲ್ ಸೇವೆ', sub: 'CSC Digital Facilitator', icon: '💻', trade: 'Domestic Data Entry', skills: 'Typing, internet schemes' },
      { id: 'handloom', title: 'ಕೈಮಗ್ಗ ಮತ್ತು ಕರಕುಶಲತೆ', sub: 'Handloom Weaving & Craft', icon: '🎨', trade: 'Handloom Weaver', skills: 'Loom operation, silk weaving' },
    ],
    ml: [
      { id: 'stitching', title: 'തയ്യൽ & വസ്ത്ര നിർമ്മാണം', sub: 'Garments & Tailoring', icon: '🧵', trade: 'Tailoring & Garments', skills: 'Machine stitching, design' },
      { id: 'leather', title: 'തുകൽ & പാദരക്ഷാ ജോലി', sub: 'Leather Footwear & Goods', icon: '👞', trade: 'Leather Footwear & Goods', skills: 'Leather cutting, footwear making' },
      { id: 'solar', title: 'സോളാർ ടെക് & ഇലക്ട്രീഷ്യൻ', sub: 'Solar Suryamitra & Electrician', icon: '☀️', trade: 'Solar Energy & Electrician', skills: 'Rooftop solar, wiring' },
      { id: 'auto', title: 'ഇരുചക്ര & ഇവി മെക്കാനിക്', sub: 'Two-Wheeler & EV Servicing', icon: '🛵', trade: 'Two Wheeler Servicing', skills: 'Engine repair, EV scooter' },
      { id: 'dairy', title: 'ക്ഷീരോൽപ്പാദനം & മൃഗസംരക്ഷണം', sub: 'Dairy Farming & Cattle', icon: '🐄', trade: 'Dairy & Animal Husbandry', skills: 'Milk chilling, cattle feed' },
      { id: 'mason', title: 'കെട്ടിട നിർമ്മാണം & മേസ്തിരി', sub: 'Construction & Masonry', icon: '🧱', trade: 'Construction & Masonry', skills: 'Plastering, tile fixing' },
      { id: 'digital', title: 'കമ്പ്യൂട്ടർ & ഡാറ്റ എൻട്രി', sub: 'CSC Digital Facilitator', icon: '💻', trade: 'Domestic Data Entry', skills: 'Typing, e-governance' },
      { id: 'handloom', title: 'കൈത്തറി & കയർ കരകൗശലം', sub: 'Handloom & Coir Crafts', icon: '🎨', trade: 'Handloom Weaver', skills: 'Coir spinning, loom weaving' },
    ],
    hi: [
      { id: 'leather', title: 'चमड़ा व जूता निर्माण', sub: 'Leather Goods & Footwear', icon: '👞', trade: 'Leather Footwear & Goods', skills: 'Hand stitching, cutting, leather tooling' },
      { id: 'stitching', title: 'सिलाई व परिधान', sub: 'Garment & Sewing Machine', icon: '🧵', trade: 'Tailoring & Garment Making', skills: 'Sewing machine operation, pattern cutting' },
      { id: 'solar', title: 'सोलर व बिजली (सूर्यमित्र)', sub: 'Solar Tech & Electrician', icon: '☀️', trade: 'Solar Energy & Electrician', skills: 'Wiring, solar inverter & panel installation' },
      { id: 'auto', title: 'बाइक व ऑटो मैकेनिक', sub: 'Two-Wheeler & EV Mechanic', icon: '🛵', trade: 'Two Wheeler Servicing', skills: 'Engine overhaul, electrical repair, EV scooter' },
      { id: 'mason', title: 'भवन निर्माण व राजमिस्त्री', sub: 'Masonry & Construction', icon: '🧱', trade: 'Construction & Masonry', skills: 'Brick laying, plastering, tile fitting' },
      { id: 'dairy', title: 'डेयरी व पशुपालन', sub: 'Dairy Farming & Livestock', icon: '🐄', trade: 'Dairy & Animal Husbandry', skills: 'Milk handling, cattle management, fodder' },
      { id: 'digital', title: 'कंप्यूटर व डेटा एंट्री', sub: 'CSC Digital Facilitator', icon: '💻', trade: 'Domestic Data Entry Operator', skills: 'Typing, internet banking, online forms' },
      { id: 'handloom', title: 'हथकरघा व दस्तकारी', sub: 'Handloom & Handicrafts', icon: '🎨', trade: 'Handloom Weaver', skills: 'Loom operation, zari weaving, yarn processing' },
    ],
  };

  // Languages without their own cards fall back to the English sub-labels
  const tradeOptions = tradeCardsByLang[currentLanguage] || tradeCardsByLang.hi.map((o) => ({ ...o, title: o.sub, sub: '' }));

  // Localized education options
  const eduOptionsByLang: Record<string, Array<{ label: string; sub: string; val: string }>> = {
    ta: [
      { label: 'முறையான பள்ளிப் படிப்பு இல்லை', sub: 'Non-formal / Literate', val: 'Non-Formal' },
      { label: '5-ஆம் வகுப்பு தேர்ச்சி', sub: 'Primary School (5th)', val: '5th Pass' },
      { label: '8-ஆம் வகுப்பு தேர்ச்சி', sub: 'Middle School (8th)', val: '8th Pass' },
      { label: '10-ஆம் வகுப்பு தேர்ச்சி (SSLC)', sub: 'High School (10th)', val: '10th Pass' },
      { label: '12-ஆம் வகுப்பு (+2)', sub: 'Higher Secondary (12th)', val: '12th Pass' },
      { label: 'ஐடிஐ / பட்டயம் / பட்டதாரி', sub: 'ITI / Diploma / Graduate', val: 'Graduate' },
    ],
    te: [
      { label: 'బడికి వెళ్ళలేదు / అక్షరాస్యులు', sub: 'Non-formal / Literate', val: 'Non-Formal' },
      { label: '5వ తరగతి పాస్', sub: 'Primary School (5th)', val: '5th Pass' },
      { label: '8వ తరగతి పాస్', sub: 'Middle School (8th)', val: '8th Pass' },
      { label: '10వ తరగతి పాస్ (SSC)', sub: 'High School (10th)', val: '10th Pass' },
      { label: '12వ తరగతి (ఇంటర్)', sub: 'Intermediate (12th)', val: '12th Pass' },
      { label: 'ఐటీఐ / డిప్లొమా / డిగ్రీ', sub: 'ITI / Diploma / Graduate', val: 'Graduate' },
    ],
    kn: [
      { label: 'ಔಪಚಾರಿಕ ಶಿಕ್ಷಣವಿಲ್ಲ', sub: 'Non-formal / Literate', val: 'Non-Formal' },
      { label: '5 ನೇ ತರಗತಿ ಪಾಸು', sub: 'Primary School (5th)', val: '5th Pass' },
      { label: '8 ನೇ ತರಗತಿ ಪಾಸು', sub: 'Middle School (8th)', val: '8th Pass' },
      { label: '10 ನೇ ತರಗತಿ (SSLC)', sub: 'High School (10th)', val: '10th Pass' },
      { label: '12 ನೇ ತರಗತಿ (PUC)', sub: 'Intermediate (12th)', val: '12th Pass' },
      { label: 'ಐಟಿಐ / ಡಿಪ್ಲೊಮಾ / ಪದವಿ', sub: 'ITI / Diploma / Graduate', val: 'Graduate' },
    ],
    ml: [
      { label: 'സ്കൂൾ വിദ്യാഭ്യാസമില്ല', sub: 'Non-formal / Literate', val: 'Non-Formal' },
      { label: '5-ാം ക്ലാസ് പാസ്', sub: 'Primary School (5th)', val: '5th Pass' },
      { label: '8-ാം ക്ലാസ് പാസ്', sub: 'Middle School (8th)', val: '8th Pass' },
      { label: '10-ാം ക്ലാസ് (SSLC)', sub: 'High School (10th)', val: '10th Pass' },
      { label: '12-ാം ക്ലാസ് (+2)', sub: 'Higher Secondary (12th)', val: '12th Pass' },
      { label: 'ഐടിഐ / ഡിപ്ലോമ / ബിരുദം', sub: 'ITI / Diploma / Graduate', val: 'Graduate' },
    ],
    hi: [
      { label: 'कोई औपचारिक पढ़ाई नहीं', sub: 'Non-formal / Literate', val: 'Non-Formal' },
      { label: '5वीं पास', sub: 'Primary School (5th)', val: '5th Pass' },
      { label: '8वीं पास', sub: 'Middle School (8th)', val: '8th Pass' },
      { label: '10वीं पास (हाईस्कूल)', sub: 'High School (10th)', val: '10th Pass' },
      { label: '12वीं पास (इंटर)', sub: 'Intermediate (12th)', val: '12th Pass' },
      { label: 'ITI / डिप्लोमा या स्नातक', sub: 'ITI / Diploma / Graduate', val: 'Graduate' },
    ],
  };

  const eduOptions = eduOptionsByLang[currentLanguage] || eduOptionsByLang.hi.map((o) => ({ ...o, label: o.sub, sub: '' }));

  const EN_GOAL_BENEFITS: Record<string, string> = {
    self: 'PM-AJAY grants and loan schemes (subject to rules)',
    wage: 'Better job prospects with NSQF certification',
    shg: 'Financial support schemes for self-help groups',
  };

  // Localized goal options
  const goalOptionsByLang: Record<string, Array<{ id: string; title: string; sub: string; benefit: string; val: BeneficiaryProfile['workPreference']; icon: string }>> = {
    ta: [
      { id: 'self', title: 'சொந்த கடை அல்லது குறுந்தொழில்', sub: 'Self-Employment / Micro-Enterprise', benefit: 'PM-AJAY மானியம் மற்றும் கடன் திட்டங்கள் (விதிகளுக்கு உட்பட்டு)', val: 'Self-Employment / Micro-enterprise', icon: '🏪' },
      { id: 'wage', title: 'தொழிற்சாலை அல்லது நிறுவன வேலை', sub: 'Wage Employment in Industry', benefit: 'NSQF சான்றிதழுடன் சிறந்த வேலை வாய்ப்புகள்', val: 'Wage Employment', icon: '🏭' },
      { id: 'shg', title: 'மகளிர் சுயஉதவிக் குழு தொழில்', sub: 'SC Women SHG Collective Enterprise', benefit: 'சுய உதவிக் குழுக்களுக்கான நிதி உதவித் திட்டங்கள்', val: 'SHG Group Business', icon: '🤝' },
    ],
    te: [
      { id: 'self', title: 'స్వంత దుకాణం లేదా సూక్ష్మ వ్యాపారం', sub: 'Self-Employment / Micro-Enterprise', benefit: 'PM-AJAY గ్రాంట్ మరియు రుణ పథకాలు (నియమాలకు లోబడి)', val: 'Self-Employment / Micro-enterprise', icon: '🏪' },
      { id: 'wage', title: 'కంపెనీ లేదా పరిశ్రమలో నెలవారీ ఉద్యోగం', sub: 'Wage Employment in Industry', benefit: 'NSQF సర్టిఫికేషన్‌తో మెరుగైన ఉద్యోగ అవకాశాలు', val: 'Wage Employment', icon: '🏭' },
      { id: 'shg', title: 'మహిళా స్వయం సహాయక సంఘం (SHG)', sub: 'SC SHG Collective Enterprise', benefit: 'స్వయం సహాయక సంఘాలకు ఆర్థిక సహాయ పథకాలు', val: 'SHG Group Business', icon: '🤝' },
    ],
    kn: [
      { id: 'self', title: 'ಸ್ವಂತ ಅಂಗಡಿ ಅಥವಾ ಕಿರು ಉದ್ಯಮ', sub: 'Self-Employment / Micro-Enterprise', benefit: 'PM-AJAY ಅನುದಾನ ಮತ್ತು ಸಾಲ ಯೋಜನೆಗಳು (ನಿಯಮಗಳಿಗೆ ಒಳಪಟ್ಟು)', val: 'Self-Employment / Micro-enterprise', icon: '🏪' },
      { id: 'wage', title: 'ಕಾರ್ಖಾನೆಯಲ್ಲಿ ಮಾಸಿಕ ಸಂಬಳದ ಕೆಲಸ', sub: 'Wage Employment in Industry', benefit: 'NSQF ಪ್ರಮಾಣಪತ್ರದೊಂದಿಗೆ ಉತ್ತಮ ಉದ್ಯೋಗಾವಕಾಶಗಳು', val: 'Wage Employment', icon: '🏭' },
      { id: 'shg', title: 'ಮಹಿಳಾ ಸ್ವಸಹಾಯ ಸಂಘ (SHG)', sub: 'SC Women SHG Enterprise', benefit: 'ಸ್ವಸಹಾಯ ಗುಂಪುಗಳಿಗೆ ಆರ್ಥಿಕ ನೆರವು ಯೋಜನೆಗಳು', val: 'SHG Group Business', icon: '🤝' },
    ],
    ml: [
      { id: 'self', title: 'സ്വന്തം കട അല്ലെങ്കിൽ ചെറുകിട സംരംഭം', sub: 'Self-Employment / Micro-Enterprise', benefit: 'PM-AJAY ഗ്രാന്റ്, വായ്പാ പദ്ധതികൾ (നിയമങ്ങൾക്ക് വിധേയമായി)', val: 'Self-Employment / Micro-enterprise', icon: '🏪' },
      { id: 'wage', title: 'ഫാക്ടറി അല്ലെങ്കിൽ കമ്പനി ജോലി', sub: 'Wage Employment in Industry', benefit: 'NSQF സർട്ടിഫിക്കറ്റോടെ മികച്ച തൊഴിലവസരങ്ങൾ', val: 'Wage Employment', icon: '🏭' },
      { id: 'shg', title: 'വനിതാ സ്വയംസഹായ സംഘം (SHG)', sub: 'SC Women SHG Enterprise', benefit: 'സ്വയം സഹായ സംഘങ്ങൾക്കുള്ള സാമ്പത്തിക സഹായ പദ്ധതികൾ', val: 'SHG Group Business', icon: '🤝' },
    ],
    hi: [
      { id: 'self', title: 'खुद की दुकान या सूक्ष्म उद्योग', sub: 'Self-Employment / Micro-Enterprise', benefit: 'PM-AJAY अनुदान और ऋण योजनाएँ (नियमों के अनुसार)', val: 'Self-Employment / Micro-enterprise', icon: '🏪' },
      { id: 'wage', title: 'कारखाने या कंपनी में मासिक नौकरी', sub: 'Wage Employment in Industry', benefit: 'NSQF प्रमाणन के साथ बेहतर रोज़गार के अवसर', val: 'Wage Employment', icon: '🏭' },
      { id: 'shg', title: 'महिला स्वयं सहायता समूह (SHG)', sub: 'SC SHG Collective Enterprise', benefit: 'स्वयं सहायता समूहों के लिए वित्तीय सहायता योजनाएँ', val: 'SHG Group Business', icon: '🤝' },
    ],
  };

  const goalOptions = goalOptionsByLang[currentLanguage] || goalOptionsByLang.hi.map((o) => ({ ...o, title: o.sub, sub: '', benefit: EN_GOAL_BENEFITS[o.id] || '' }));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Kiosk Header Card */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 rounded-3xl p-6 text-slate-950 shadow-2xl mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-slate-950 text-amber-300 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase">
              {ui.kioskTitle}
            </span>
            <span className="bg-amber-300/40 text-slate-950 font-bold px-2.5 py-0.5 rounded-full text-xs">
              {langConfig.nativeName} ({langConfig.name})
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-950 tracking-tight">
            PM-AJAY {ui.kioskTitle}
          </h2>
          <p className="text-slate-900 font-semibold text-sm md:text-base mt-1">
            {ui.tagline}
          </p>
        </div>

        <button
          onClick={() => speakPrompt(langConfig.sampleGreeting)}
          className="px-4 py-3 rounded-2xl bg-slate-950 text-amber-300 font-bold text-sm flex items-center gap-2 hover:bg-slate-900 shadow-xl transition transform active:scale-95"
        >
          <Volume2 className="w-5 h-5 text-amber-400 animate-pulse" />
          <span>{ui.kioskHearPrompt}</span>
        </button>
      </div>

      {/* Step Indicator */}
      <div className="grid grid-cols-4 gap-2 mb-8">
        {[
          { step: 1, label: ui.kioskStep1, icon: GraduationCap },
          { step: 2, label: ui.kioskStep2, icon: Wrench },
          { step: 3, label: ui.kioskStep3, icon: Briefcase },
          { step: 4, label: ui.kioskStep4, icon: Award },
        ].map((item) => (
          <button
            key={item.step}
            onClick={() => setActiveStep(item.step)}
            className={`p-3 rounded-2xl text-xs md:text-sm font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition ${
              activeStep === item.step
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                : activeStep > item.step
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: Education Level */}
      {activeStep === 1 && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-white">{ui.educationLabel}</h3>
              <p className="text-slate-400 text-sm mt-1">{ui.startFreshPrompt}</p>
            </div>
            <button
              onClick={() => speakPrompt(ui.educationLabel)}
              className="p-2.5 rounded-xl bg-slate-800 text-amber-300 hover:bg-slate-700"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {eduOptions.map((edu) => (
              <button
                key={edu.val}
                onClick={() => {
                  onUpdateProfile({ education: edu.val });
                  speakPrompt(edu.label);
                }}
                className={`p-5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between h-32 ${
                  userProfile.education === edu.val
                    ? 'border-amber-400 bg-amber-500/20 text-white shadow-xl shadow-amber-500/20'
                    : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <span className="text-base md:text-lg font-black">{edu.label}</span>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{edu.sub}</span>
                  {userProfile.education === edu.val && (
                    <Check className="w-5 h-5 text-amber-400 stroke-[3]" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setActiveStep(2)}
              className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition transform active:scale-95"
            >
              <span>{ui.kioskNext}: {ui.kioskStep2}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Trade & Skills Selection */}
      {activeStep === 2 && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-white">{ui.tradeLabel}</h3>
              <p className="text-slate-400 text-sm mt-1">{ui.kioskStep2}</p>
            </div>
            <button
              onClick={() => speakPrompt(ui.tradeLabel)}
              className="p-2.5 rounded-xl bg-slate-800 text-amber-300 hover:bg-slate-700"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tradeOptions.map((tr) => (
              <button
                key={tr.id}
                onClick={() => {
                  onUpdateProfile({
                    traditionalTrade: tr.trade,
                    existingSkills: tr.skills,
                  });
                  speakPrompt(tr.title);
                }}
                className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between h-40 ${
                  userProfile.traditionalTrade === tr.trade
                    ? 'border-amber-400 bg-amber-500/20 text-white shadow-xl shadow-amber-500/20'
                    : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <div className="text-3xl mb-2">{tr.icon}</div>
                <div>
                  <h4 className="font-black text-sm md:text-base leading-tight text-white">{tr.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{tr.sub}</p>
                </div>
                <div className="flex items-center justify-end">
                  {userProfile.traditionalTrade === tr.trade ? (
                    <Check className="w-5 h-5 text-amber-400 stroke-[3]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setActiveStep(1)}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm"
            >
              {ui.kioskBack}
            </button>
            <button
              onClick={() => setActiveStep(3)}
              className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition transform active:scale-95"
            >
              <span>{ui.kioskNext}: {ui.kioskStep3}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Livelihood Goal Selection */}
      {activeStep === 3 && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl md:text-2xl font-black text-white">{ui.kioskStep3}</h3>
              <p className="text-slate-400 text-sm mt-1">{ui.pmAjayGrantSubsidy}</p>
            </div>
            <button
              onClick={() => speakPrompt(ui.kioskStep3)}
              className="p-2.5 rounded-xl bg-slate-800 text-amber-300 hover:bg-slate-700"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {goalOptions.map((pref) => (
              <button
                key={pref.id}
                onClick={() => {
                  onUpdateProfile({ workPreference: pref.val });
                  speakPrompt(pref.title);
                }}
                className={`p-6 rounded-3xl text-left border-2 transition-all flex flex-col justify-between ${
                  userProfile.workPreference === pref.val
                    ? 'border-amber-400 bg-amber-500/20 text-white shadow-xl shadow-amber-500/20'
                    : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <div>
                  <span className="text-4xl mb-3 block">{pref.icon}</span>
                  <h4 className="text-lg font-black text-white">{pref.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{pref.sub}</p>
                  <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs text-amber-300 font-medium">
                    {pref.benefit}
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  {userProfile.workPreference === pref.val && (
                    <Check className="w-6 h-6 text-amber-400 stroke-[3]" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-between">
            <button
              onClick={() => setActiveStep(2)}
              className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm"
            >
              {ui.kioskBack}
            </button>
            <button
              onClick={() => {
                setActiveStep(4);
                onGenerateRoadmap();
              }}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-base flex items-center gap-2 shadow-xl shadow-amber-500/30 transition transform active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-slate-950" />
              <span>{ui.generateRoadmap}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Government Grants & NSQF Roadmap */}
      {activeStep === 4 && (
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                  PM-AJAY GIA Approved
                </span>
                <span className="text-slate-400 text-xs">
                  {userProfile.name ? `${userProfile.name} • ` : ''}{userProfile.district || 'District'}
                </span>
              </div>
              <h3 className="text-2xl font-black text-white">{ui.nsqfRecommendations}</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  speakPrompt(
                    roadmap?.audioNarrationScript ||
                      ui.freshBannerDesc
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-amber-400 shadow-md shadow-amber-500/20"
              >
                <Volume2 className="w-4 h-4" />
                <span>{ui.kioskHearPrompt}</span>
              </button>
              <button
                onClick={onOpenKaushalPatra}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700"
              >
                {ui.downloadDossier}
              </button>
            </div>
          </div>

          {/* Three Major Entitlement Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-amber-950/40 border border-amber-500/30">
              <span className="text-xs uppercase font-bold text-amber-400">1. {ui.pmAjayGrantSubsidy}</span>
              <div className="text-3xl font-black text-white mt-1"></div>
              <p className="text-xs text-slate-300 mt-2">
                PM-AJAY (GIA) 50% non-refundable capital subsidy for individual micro-enterprise.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-emerald-950/40 border border-emerald-500/30">
              <span className="text-xs uppercase font-bold text-emerald-400">2. Free NSQF Skilling</span>
              <div className="text-3xl font-black text-white mt-1">100% Free</div>
              <p className="text-xs text-slate-300 mt-2">
                Free certified training under PMKVY / PM-DAKSH; some programmes also pay a stipend.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-blue-950/40 border border-blue-500/30">
              <span className="text-xs uppercase font-bold text-blue-400">3. Loans & Toolkits</span>
              <div className="text-3xl font-black text-white mt-1">MUDRA · NSFDC</div>
              <p className="text-xs text-slate-300 mt-2">
                Collateral-free and concessional loans; toolkit support under schemes like PM Vishwakarma.
              </p>
            </div>
          </div>

          {/* Recommended Course Cards */}
          <div>
            <h4 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">
              {ui.nsqfRecommendations}:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(roadmap?.nsqfCourses || []).slice(0, 2).map((course, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        {course.nsqfLevel} • {course.qpCode}
                      </span>
                      <span className="text-xs text-emerald-400 font-semibold">
                        {course.durationHours}
                      </span>
                    </div>
                    <h5 className="font-black text-base text-white">{course.jobRole}</h5>
                    <p className="text-xs text-slate-400 mt-1">{course.sector}</p>
                    <p className="text-xs text-slate-300 mt-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                      {course.whyFit}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold">✓ Daily Stipend Covered</span>
                    <button
                      onClick={() => speakPrompt(`${course.jobRole}, ${course.durationHours}`)}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{ui.kioskHearPrompt}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
            <button
              onClick={() => setActiveStep(1)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{ui.newRegistration}</span>
            </button>

            <button
              onClick={onOpenKaushalPatra}
              className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <span>{ui.downloadDossier}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
