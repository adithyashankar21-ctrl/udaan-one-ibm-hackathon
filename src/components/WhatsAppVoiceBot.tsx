import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Phone, 
  Video, 
  MoreVertical, 
  Paperclip, 
  Smile, 
  CheckCheck, 
  Play, 
  Pause, 
  ShieldCheck, 
  Sparkles,
  Volume2,
  StopCircle,
  AlertCircle
} from 'lucide-react';
import { BeneficiaryProfile, LanguageCode, LivelihoodAnalysis } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { aiService, offlineReply } from '../services/aiService';

interface WhatsAppVoiceBotProps {
  currentLanguage: LanguageCode;
  userProfile: BeneficiaryProfile;
  onUpdateProfile: (profile: Partial<BeneficiaryProfile>) => void;
  onGenerateRoadmap: () => void;
  roadmap: LivelihoodAnalysis | null;
  onOpenKaushalPatra: () => void;
}

// Localized initial greetings for each language
const INITIAL_GREETINGS: Record<string, { welcome: string; audioText: string; audioDuration: string }> = {
  ta: {
    welcome: '🙏 வணக்கம்! UDAAN ONE வாட்ஸ்அப் உதவி மையத்திற்கு உங்களை வரவேற்கிறோம். நீங்கள் தட்டச்சு செய்தோ அல்லது மைக் பட்டனை அழுத்தி குரல் குறிப்பு (Voice Note) மூலமாகவோ பேசலாம்.',
    audioText: 'கேளுங்கள்: SC இளைஞர்கள் மற்றும் கைவினைஞர்களுக்கான இலவச NSQF பயிற்சி, கடன் மற்றும் மானியத் திட்டங்கள் பற்றி நான் உதவுவேன்.',
    audioDuration: '0:14',
  },
  te: {
    welcome: '🙏 నమస్కారం! UDAAN ONE వాట్సాప్ సేవకు స్వాగతం. మీరు టైప్ చేయవచ్చు లేదా మైక్ బటన్ నొక్కి వాయిస్ నోట్ పంపవచ్చు.',
    audioText: 'వినండి: ఎస్సీ యువత మరియు చేతివృత్తుల వారికి ఉచిత NSQF శిక్షణ, రుణ మరియు సబ్సిడీ పథకాల గురించి నేను సహాయం చేస్తాను.',
    audioDuration: '0:13',
  },
  kn: {
    welcome: '🙏 ನಮಸ್ಕಾರ! UDAAN ONE ವಾಟ್ಸಾಪ್ ಸೇವೆಗೆ ಸುಸ್ವಾಗತ. ನೀವು ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮೈಕ್ ಬಟನ್ ಒತ್ತಿ ಧ್ವನಿ ಸಂದೇಶ ಕಳುಹಿಸಬಹುದು.',
    audioText: 'ಕೇಳಿ: ಪರಿಶಿಷ್ಟ ಜಾತಿ ಯುವಕರು ಮತ್ತು ಕುಶಲಕರ್ಮಿಗಳಿಗೆ ಉಚಿತ NSQF ತರಬೇತಿ, ಸಾಲ ಮತ್ತು ಸಬ್ಸಿಡಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.',
    audioDuration: '0:13',
  },
  ml: {
    welcome: '🙏 നമസ്കാരം! UDAAN ONE വാട്ട്സ്ആപ്പ് സേവനത്തിലേക്ക് സ്വാഗതം. നിങ്ങൾക്ക് സന്ദേശം ടൈപ്പ് ചെയ്യുകയോ വോയ്‌സ് നോട്ട് അയക്കുകയോ ചെയ്യാം.',
    audioText: 'കേൾക്കൂ: എസ്‌സി യുവാക്കൾക്കും കരകൗശല വിദഗ്ധർക്കും സൗജന്യ NSQF പരിശീലനവും മൂലധന സബ്‌സിഡിയും ലഭ്യമാണ്.',
    audioDuration: '0:14',
  },
  hi: {
    welcome: '🙏 जय भीम / नमस्ते! UDAAN ONE व्हाट्सएप सेवा में आपका स्वागत है। आप टेक्स्ट लिखकर या अपना वॉइस नोट (माइक बटन दबाकर) भेज सकते हैं।',
    audioText: 'सुनिए: अनुसूचित जाति के युवाओं व कारीगरों के लिए मुफ्त NSQF प्रशिक्षण, ऋण और अनुदान योजनाओं की जानकारी में मैं आपकी मदद करूँगा।',
    audioDuration: '0:14',
  },
  en: {
    welcome: '🙏 Welcome to the UDAAN ONE WhatsApp assistant. You can type your query or press the microphone button to send a live voice note.',
    audioText: 'Listen: I can help you with free NSQF skill training, loans and grant schemes for SC communities.',
    audioDuration: '0:15',
  },
};

// Quick prompt suggestions localized per language
const QUICK_SUGGESTIONS: Record<string, Array<{ label: string; text: string }>> = {
  ta: [
    { label: '💰 PM-AJAY மானியம்', text: 'எனது கடைக்கு PM-AJAY மூலம் மூலதன மானியம் பெறுவது எப்படி?' },
    { label: '🎓 இலவச NSQF பயிற்சி', text: 'மதுரையில் இலவச தையல் அல்லது ஆடை தயாரிப்பு NSQF பயிற்சி எங்குள்ளது?' },
    { label: '🛵 இருசக்கர வாகனம் & சோலார்', text: 'இருசக்கர வாகன மெக்கானிக் மற்றும் சூரிய மின்சக்தி பயிற்சி விவரங்கள் தேவை' },
  ],
  te: [
    { label: '💰 PM-AJAY సబ్సిడీ', text: 'నా వ్యాపారానికి PM-AJAY ద్వారా మూలధన సబ్సిడీ ఎలా పొందాలి?' },
    { label: '🎓 ఉచిత NSQF శిక్షణ', text: 'వరంగల్ జిల్లాలో ఉచిత NSQF శిక్షణ కేంద్రాలు మరియు కోర్సుల వివరాలు చెప్పండి' },
  ],
  kn: [
    { label: '💰 PM-AJAY ಸಬ್ಸಿಡಿ', text: 'ನನ್ನ ಅಂಗಡಿಗೆ PM-AJAY ಮೂಲಕ ಬಂಡವಾಳ ಸಬ್ಸಿಡಿ ಪಡೆಯುವುದು ಹೇಗೆ?' },
    { label: '🎓 ಉಚಿತ NSQF ತರಬೇತಿ', text: 'ಬೆಳಗಾವಿ ಜಿಲ್ಲೆಯಲ್ಲಿ ಸೋಲಾರ್ ಮತ್ತು ಎಲೆಕ್ಟ್ರಿಷಿಯನ್ ತರಬೇತಿ ಲಭ್ಯವಿದೆಯೇ?' },
  ],
  ml: [
    { label: '💰 PM-AJAY സബ്‌സിഡി', text: 'എന്റെ കടയ്ക്കായി PM-AJAY വഴി മൂലധന സബ്‌സിഡി എങ്ങനെ ലഭിക്കും?' },
    { label: '🎓 സൗജന്യ NSQF പരിശീലനം', text: 'പാലക്കാട് ജില്ലയിൽ ലഭ്യമായ ഡയറി மற்றும் സ്കില്ലിംഗ് കോഴ്സുകൾ ഏവ?' },
  ],
  hi: [
    { label: '💰 PM-AJAY सब्सिडी', text: 'मुझे PM-AJAY GIA पूंजी सब्सिडी के बारे में बताएं' },
    { label: '🎓 मुफ्त NSQF ट्रेनिंग', text: 'मुफ्त NSQF सिलाई, लेदर या सोलर का कोर्स कहां उपलब्ध है?' },
    { label: '🛵 बाइक व ऑटो मैकेनिक', text: 'दोपहिया वाहन और ईवी मैकेनिक कोर्स और टूलकिट की जानकारी दें' },
  ],
  en: [
    { label: '💰 PM-AJAY Grant', text: 'How do I apply for the PM-AJAY capital subsidy for my micro-enterprise?' },
    { label: '🎓 Free NSQF Courses', text: 'What free NSQF training courses and daily stipends are available for SC artisans?' },
    { label: '🔧 Tailoring & Leather', text: 'Tell me about tailoring and leather footwear training and toolkit grant' },
  ],
};

export const WhatsAppVoiceBot: React.FC<WhatsAppVoiceBotProps> = ({
  currentLanguage,
  userProfile,
  onUpdateProfile,
  onGenerateRoadmap,
  roadmap,
  onOpenKaushalPatra,
}) => {
  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const langKey = currentLanguage in INITIAL_GREETINGS ? currentLanguage : 'en';

  const [messages, setMessages] = useState<Array<{
    id: string;
    sender: 'user' | 'bot';
    text: string;
    isAudioNote?: boolean;
    audioDuration?: string;
    audioUrl?: string;
    time: string;
  }>>([
    {
      id: 'wa-1',
      sender: 'bot',
      text: INITIAL_GREETINGS[langKey]?.welcome || INITIAL_GREETINGS.en.welcome,
      time: '10:02 AM',
    },
    {
      id: 'wa-2',
      sender: 'bot',
      isAudioNote: true,
      audioDuration: INITIAL_GREETINGS[langKey]?.audioDuration || '0:14',
      text: INITIAL_GREETINGS[langKey]?.audioText || INITIAL_GREETINGS.en.audioText,
      time: '10:02 AM',
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update initial messages when user switches language if no conversation has happened yet
  useEffect(() => {
    const defaultWelcome = INITIAL_GREETINGS[langKey]?.welcome || INITIAL_GREETINGS.en.welcome;
    const defaultAudio = INITIAL_GREETINGS[langKey]?.audioText || INITIAL_GREETINGS.en.audioText;
    const defaultDur = INITIAL_GREETINGS[langKey]?.audioDuration || '0:14';

    setMessages((prev) => {
      // If user hasn't sent any messages yet, reset to new language greeting
      const userSent = prev.some((m) => m.sender === 'user');
      if (!userSent) {
        return [
          {
            id: `wa-1-${currentLanguage}`,
            sender: 'bot',
            text: defaultWelcome,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          {
            id: `wa-2-${currentLanguage}`,
            sender: 'bot',
            isAudioNote: true,
            audioDuration: defaultDur,
            text: defaultAudio,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      }
      return prev;
    });
  }, [currentLanguage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBotTyping, isTranscribingVoice]);

  // Profile data extraction across English, Tamil, Telugu, Kannada, Malayalam, Hindi
  const analyzeAndExtractProfileData = (text: string): Partial<BeneficiaryProfile> => {
    const lower = text.toLowerCase();
    const updates: Partial<BeneficiaryProfile> = {};

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
      'palakkad': { district: 'Palakkad', state: 'Kerala' },
      'പാലക്കാട്': { district: 'Palakkad', state: 'Kerala' },
      'agra': { district: 'Agra', state: 'Uttar Pradesh' },
      'आगरा': { district: 'Agra', state: 'Uttar Pradesh' },
    };

    for (const [key, loc] of Object.entries(districtMappings)) {
      if (lower.includes(key)) {
        updates.district = loc.district;
        updates.state = loc.state;
        break;
      }
    }

    if (lower.includes('चमड़ा') || lower.includes('leather') || lower.includes('जूता') || lower.includes('shoe') || lower.includes('தோல்') || lower.includes('காலணி') || lower.includes('లెదర్') || lower.includes('ಚರ್ಮ')) {
      updates.traditionalTrade = 'Leather Footwear & Goods';
      updates.existingSkills = userProfile.existingSkills ? `${userProfile.existingSkills}, Leather crafting` : 'Leather stitching & assembly';
    }
    if (lower.includes('सिलाई') || lower.includes('tailor') || lower.includes('stitching') || lower.includes('कपड़े') || lower.includes('garment') || lower.includes('தையல்') || lower.includes('டைலரிங்') || lower.includes('ಟೈಲರಿಂಗ್')) {
      updates.existingSkills = userProfile.existingSkills ? `${userProfile.existingSkills}, Garment sewing` : 'Basic machine stitching';
      updates.currentOccupation = 'Tailoring / Garment Worker';
      updates.traditionalTrade = 'Tailoring & Garments';
    }
    if (lower.includes('solar') || lower.includes('सोलर') || lower.includes('बिजली') || lower.includes('electric') || lower.includes('சூரிய') || lower.includes('సూర్యమిత్ర') || lower.includes('ಸೋಲಾರ್')) {
      updates.existingSkills = 'Electrical & Wiring';
      updates.traditionalTrade = 'Solar Energy & Electrician';
    }

    if (Object.keys(updates).length > 0) {
      onUpdateProfile(updates);
    }
    return updates;
  };

  const handleSendTextMessage = async (customText?: string, isFromAudioNote: boolean = false, recordedBlob?: Blob) => {
    const text = (customText || inputMessage).trim();
    if (!text || isBotTyping) return;

    setInputMessage('');
    const extractedUpdates = analyzeAndExtractProfileData(text);
    const effectiveProfile = { ...userProfile, ...extractedUpdates };

    const newMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user' as const,
      text,
      isAudioNote: isFromAudioNote,
      audioDuration: isFromAudioNote ? `0:0${Math.max(2, recordingSeconds)}` : undefined,
      audioUrl: recordedBlob ? URL.createObjectURL(recordedBlob) : undefined,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsBotTyping(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
      history.push({ role: 'user', content: text });

      const reply = await aiService.chatWithAssistant(
        history,
        effectiveProfile,
        langConfig.name,
        'WhatsApp Voice Bot'
      );

      setIsBotTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          isAudioNote: true,
          audioDuration: '0:18',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (e: any) {
      setIsBotTyping(false);
      console.warn('WhatsApp chat fallback:', e?.message);
      const fallbackReply = offlineReply(langKey, '');

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: fallbackReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // REAL Hardware Microphone Voice Note Recording
  const startRecordingVoiceNote = async () => {
    setMicError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMicError('Microphone not supported on this device');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: mime });

        if (blob.size < 400) {
          setIsTranscribingVoice(false);
          setIsRecording(false);
          return;
        }

        setIsTranscribingVoice(true);
        try {
          const transcript = await aiService.transcribeAudioBlob(blob, langConfig.name);
          setIsTranscribingVoice(false);
          if (transcript && transcript.trim().length > 0) {
            handleSendTextMessage(transcript.trim(), true, blob);
          } else {
            setMicError('Could not recognize voice. Please speak clearly into the mic or type.');
          }
        } catch (err: any) {
          setIsTranscribingVoice(false);
          console.warn('Voice transcribe error:', err);
          setMicError('Voice transcription service unavailable. You can type your question.');
        }
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission error:', err);
      setMicError('Microphone permission required. Please allow mic in browser settings.');
      setIsRecording(false);
    }
  };

  const stopRecordingVoiceNote = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);
  };

  const togglePlayAudio = (id: string, text: string, audioUrl?: string) => {
    if (playingAudioId === id) {
      aiService.stopAudio();
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(id);
      if (audioUrl) {
        aiService.stopAudio();
        const audio = new Audio(audioUrl);
        audio.onended = () => setPlayingAudioId(null);
        audio.onerror = () => setPlayingAudioId(null);
        audio.play().catch(() => setPlayingAudioId(null));
      } else {
        aiService.playSpeech(text, langConfig.speechLocale).then(() => {
          setPlayingAudioId(null);
        });
      }
    }
  };

  const currentSuggestions = QUICK_SUGGESTIONS[langKey] || QUICK_SUGGESTIONS.en;

  return (
    <div className="max-w-md mx-auto bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col h-[750px]">
      {/* WhatsApp Green App Bar */}
      <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm border-2 border-emerald-400">
              PV
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border border-slate-900 flex items-center justify-center">
              <ShieldCheck className="w-2.5 h-2.5 text-slate-900 stroke-[3]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm">UDAAN ONE</span>
              <span className="text-[10px] bg-emerald-600 px-1.5 py-0.2 rounded font-semibold text-emerald-100">
                AI assistant
              </span>
            </div>
            <p className="text-[11px] text-emerald-200">
              {isBotTyping ? 'recording audio note...' : isRecording ? '🔴 Listening to your voice...' : `Online • ${langConfig.nativeName} (${langConfig.name})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-emerald-100">
          <Phone className="w-4 h-4 cursor-pointer hover:text-white" />
          <Video className="w-4 h-4 cursor-pointer hover:text-white" />
          <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* WhatsApp Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0c1317]">
        {/* Encryption badge */}
        <div className="text-center my-1">
          <span className="bg-[#182229] text-amber-200/90 text-[10px] px-3 py-1 rounded-lg border border-amber-500/10 inline-block max-w-[90%] leading-relaxed">
            🔒 UDAAN ONE AI guidance — not an official government channel. Confirm details on official portals.
          </span>
        </div>

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              translate={m.sender === 'user' ? 'no' : undefined}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow ${
                m.sender === 'user'
                  ? 'bg-emerald-700 text-white rounded-tr-none'
                  : 'bg-[#202c33] text-slate-100 rounded-tl-none border border-slate-700/50'
              }`}
            >
              {/* If it's an audio note */}
              {m.isAudioNote && (
                <div className="flex items-center gap-3 py-1 mb-1 border-b border-white/10">
                  <button
                    onClick={() => togglePlayAudio(m.id, m.text, m.audioUrl)}
                    className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 hover:bg-emerald-400 transition"
                  >
                    {playingAudioId === m.id ? (
                      <Pause className="w-4 h-4 fill-slate-950" />
                    ) : (
                      <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-1 h-4">
                      {[30, 80, 45, 90, 70, 40, 85, 60, 95, 50, 75, 40, 80].map((h, idx) => (
                        <span
                          key={idx}
                          className={`w-1 rounded-full ${
                            playingAudioId === m.id ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {m.sender === 'user' ? '🎤 Voice Note • ' : '🎙️ Audio • '}
                      {m.audioDuration || '0:15'}
                    </span>
                  </div>
                </div>
              )}

              <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

              <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400">
                <span>{m.time}</span>
                {m.sender === 'user' && <CheckCheck className="w-3.5 h-3.5 text-blue-400" />}
              </div>
            </div>
          </div>
        ))}

        {isTranscribingVoice && (
          <div className="flex items-center gap-2 text-slate-300 text-xs bg-[#202c33] px-3 py-2 rounded-xl max-w-xs border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Transcribing your live voice message with AI...</span>
          </div>
        )}

        {isBotTyping && (
          <div className="flex items-center gap-2 text-slate-400 text-xs bg-[#202c33] px-3 py-2 rounded-xl max-w-xs border border-slate-700/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>UDAAN ONE is preparing your skilling response...</span>
          </div>
        )}

        {micError && (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{micError}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Tap Buttons for WhatsApp */}
      <div className="bg-[#111b21] px-3 py-2 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {currentSuggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => handleSendTextMessage(item.text)}
            className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] bg-[#202c33] text-emerald-400 border border-emerald-500/30 hover:bg-emerald-950 font-medium transition"
          >
            {item.label}
          </button>
        ))}
        <button
          onClick={onGenerateRoadmap}
          className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
        >
          📄 {langKey === 'ta' ? 'ரோட்மேப்' : langKey === 'te' ? 'రోడ్‌మ్యాప్' : 'कौशल पत्र'}
        </button>
      </div>

      {/* Bottom WhatsApp Input Bar */}
      <div className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2">
        <Smile className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />
        <Paperclip className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer" />

        {isRecording ? (
          <div className="flex-1 flex items-center justify-between bg-rose-950/40 border border-rose-500/40 rounded-xl px-3 py-2 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-bold">Recording Voice Note... 0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}</span>
            </div>
            <button
              onClick={stopRecordingVoiceNote}
              className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[10px] flex items-center gap-1"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Send Voice</span>
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendTextMessage()}
            placeholder={`Message in ${langConfig.name} or press mic to record...`}
            className="flex-1 bg-[#2a3942] text-slate-100 placeholder:text-slate-500 rounded-xl px-3 py-2 text-xs focus:outline-none"
          />
        )}

        {inputMessage.trim() ? (
          <button
            onClick={() => handleSendTextMessage()}
            className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 transition shadow"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={isRecording ? stopRecordingVoiceNote : startRecordingVoiceNote}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition shadow ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
            title={isRecording ? 'Click to stop & send voice note' : 'Click to record live voice note'}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

