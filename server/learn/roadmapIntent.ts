/**
 * Spots requests for a career roadmap in any channel (voice, chat, WhatsApp, helpline):
 * "make me a career roadmap", "how can I become an electrician", "मुझे नर्स कैसे बनना है",
 * "what should I do after 12th". The person's own words are passed on as the request, and
 * the roadmap is made for exactly that goal.
 */

const ROADMAP_WORDS = [
  // English
  /\b(road ?map|career (plan|path|guidance|advice|options?|roadmap)|plan (for )?my (career|future)|what (job|career|work) (should|can) i|which (job|career|course) (should|is best)|what (should|can) i do after|how (can|do|should) i become|i want to become|want to be an? |become an? .{3,40} (in|after|with)|future plan)\b/i,
  // "career" and "roadmap" in Indian scripts
  /kaushal ?patra|कौशल पत्र|ಕೌಶಲ್ಯ ಪತ್ರ|करियर|कैरियर|रोडमैप|रोड मैप|कॅरिअर|கேரியர்|தொழில் வழி|ரோட்மேப்|కెరీర్|రోడ్‌మ్యాప్|ಕೆರಿಯರ್|ವೃತ್ತಿ ಮಾರ್ಗ|ರೋಡ್‌ಮ್ಯಾಪ್|കരിയർ|റോഡ്മാപ്പ്|ক্যারিয়ার|কেরিয়ার|রোডম্যাপ|કારકિર્દી|કેરિયર|રોડમેપ|ਕਰੀਅਰ|ਰੋਡਮੈਪ|କ୍ୟାରିୟର|କ୍ୟାରିଅର|ରୋଡମ୍ୟାପ|کیریئر|کیرئیر|روڈ میپ/i,
  // "how do I become …" in Hindi / Hinglish and other languages
  /(कैसे बन|बनना चाहत|बनना है|kaise ban|banna chaht|banna hai|banna chahti|आगे क्या कर|aage kya kar|எப்படி ஆவது|ஆக வேண்டும்|ఎలా అవ్వాలి|అవ్వాలనుకుంటున్నాను|ಹೇಗೆ ಆಗುವುದು|ആകാൻ എന്ത്|কীভাবে হব|કેવી રીતે બનું|ਕਿਵੇਂ ਬਣਾਂ|କିପରି ହେବି|کیسے بنوں|بننا چاہت)/i,
];

/** Applying for something or asking about a scheme belongs to the other assistants. */
const NOT_ROADMAP = /\b(apply|application|form|status|loan|emi|aadhaar|pan card|certificate number)\b|आवेदन|फॉर्म|लोन/i;

export interface RoadmapIntent {
  wantsRoadmap: boolean;
  /** What they asked for, in their words. */
  request: string | null;
}

export function detectRoadmapIntent(raw: string): RoadmapIntent {
  const text = String(raw || '').slice(0, 400).trim();
  if (!text || NOT_ROADMAP.test(text)) return { wantsRoadmap: false, request: null };
  return ROADMAP_WORDS.some((r) => r.test(text)) ? { wantsRoadmap: true, request: text } : { wantsRoadmap: false, request: null };
}
