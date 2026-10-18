import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Download, 
  Volume2, 
  Eye, 
  ExternalLink, 
  FileCheck, 
  Building2, 
  Briefcase, 
  Coins, 
  Award,
  Trash2,
  Check,
  Edit2,
  Plus,
  UploadCloud,
  X,
  Save,
  UserCheck
} from 'lucide-react';
import { 
  BeneficiaryProfile, 
  LivelihoodAnalysis, 
  VerifiedSchemeMatch, 
  DocumentRecord, 
  ApplicationDraft,
  FormFieldItem,
  Language
} from '../types';
import { schemeEngine } from '../services/schemeEngine';
import { documentIntelligence, getTemplatesForProfile, SampleDocumentTemplate } from '../services/documentIntelligence';
import { kaushalFillEngine } from '../services/kaushalFillEngine';
import { aiService } from '../services/aiService';

interface UnifiedJourneyProps {
  currentLanguage: string;
  langConfig: Language;
  userProfile: BeneficiaryProfile;
  onUpdateProfile: (updates: Partial<BeneficiaryProfile>) => void;
  roadmap: LivelihoodAnalysis | null;
  onGenerateRoadmap: () => void;
  isGeneratingRoadmap: boolean;
  onOpenKaushalPatraModal: () => void;
}

export const UnifiedJourney: React.FC<UnifiedJourneyProps> = ({
  currentLanguage,
  langConfig,
  userProfile,
  onUpdateProfile,
  roadmap,
  onGenerateRoadmap,
  isGeneratingRoadmap,
  onOpenKaushalPatraModal,
}) => {
  // Current active step in the 6-module journey (1 to 6)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Module 1 State: Citizen Need Input
  const [needInput, setNeedInput] = useState<string>(userProfile.goal || '');
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [isExtractingNeed, setIsExtractingNeed] = useState<boolean>(false);

  // Quick Inline Inputs on Step 1 for direct data entry
  const [step1Name, setStep1Name] = useState<string>(userProfile.name || '');
  const [step1Trade, setStep1Trade] = useState<string>(userProfile.traditionalTrade || '');
  const [step1District, setStep1District] = useState<string>(userProfile.district || 'Madurai');

  // Module 2 & 3 State: Scheme Intelligence & Skill Matches
  const [schemeMatches, setSchemeMatches] = useState<VerifiedSchemeMatch[]>([]);
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>('All');

  // Module 4 State: Document Intelligence
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [discrepancyList, setDiscrepancyList] = useState<string[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [editableDocFields, setEditableDocFields] = useState<Record<string, string>>({});

  // Custom Document Upload Modal State
  const [isUploadDocModalOpen, setIsUploadDocModalOpen] = useState<boolean>(false);
  const [customDocType, setCustomDocType] = useState<DocumentRecord['docType']>('Aadhaar Card');
  const [customDocNumber, setCustomDocNumber] = useState<string>('');
  const [customDocIssuer, setCustomDocIssuer] = useState<string>('');
  const [customDocSpecialValue, setCustomDocSpecialValue] = useState<string>('');

  // Module 5 State: KaushalFill Application Engine
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft | null>(null);
  const [citizenConsent, setCitizenConsent] = useState<boolean>(userProfile.consentGranted ?? false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Inline Draft Field Editor Modal State
  const [editingDraftField, setEditingDraftField] = useState<FormFieldItem | null>(null);
  const [editingDraftValue, setEditingDraftValue] = useState<string>('');

  // Audio Playback
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  // Synchronize need input & step 1 fields if userProfile changes externally
  useEffect(() => {
    if (userProfile.goal && !needInput) {
      setNeedInput(userProfile.goal);
    }
    if (userProfile.name) setStep1Name(userProfile.name);
    if (userProfile.traditionalTrade) setStep1Trade(userProfile.traditionalTrade);
    if (userProfile.district) setStep1District(userProfile.district);
  }, [userProfile]);

  // Synchronize scheme matches whenever userProfile changes
  useEffect(() => {
    const matches = schemeEngine.evaluateAllSchemes(userProfile);
    setSchemeMatches(matches);
  }, [userProfile]);

  // Update KaushalFill draft whenever documents or profile change
  useEffect(() => {
    const draft = kaushalFillEngine.buildPmajayGiaDraft(userProfile, documents);
    setApplicationDraft(draft);
  }, [userProfile, documents]);

  // Quick preset problem statements for one-tap citizen simulation
  const QUICK_PRESETS = [
    {
      title: '🧵 Madurai Tailor (Self-Employment)',
      text: 'I am a tailor in Madurai. I want to upgrade my shop with motorized sewing machines, get NSQF certification, and apply for the PM-AJAY capital subsidy.',
      trade: 'Tailoring',
      district: 'Madurai',
      state: 'Tamil Nadu',
      pathway: 'Enterprise' as const,
    },
    {
      title: '⚡ Belagavi Solar Technician (Skilling)',
      text: 'I am a 22-year-old youth from Belagavi seeking free NSQF training for Solar PV rooftop installer and monthly travel stipend under PM-AJAY.',
      trade: 'Solar PV Installer',
      district: 'Belagavi',
      state: 'Karnataka',
      pathway: 'Skilling' as const,
    },
    {
      title: '👞 Leather Artisan (Toolkit & Credit)',
      text: 'I have 8 years of traditional leather footwear making experience in Warangal. I need free modern toolkits and concessional low-interest funding to expand my unit.',
      trade: 'Leather Footwear',
      district: 'Warangal',
      state: 'Telangana',
      pathway: 'Enterprise' as const,
    },
  ];

  // Handle Voice input via browser Web Speech API
  const toggleVoiceInput = () => {
    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your request.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = langConfig.speechLocale || 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        if (spoken) {
          setNeedInput(spoken);
          extractIntentFromSpoken(spoken);
        }
        setIsListeningVoice(false);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (e) {
      setIsListeningVoice(false);
    }
  };

  const extractIntentFromSpoken = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    setIsExtractingNeed(true);

    const updates: Partial<BeneficiaryProfile> = { goal: text };
    const lower = text.toLowerCase();

    // 1. Name detection
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
        setStep1Name(match[1].trim());
        break;
      }
    }

    // 2. Trade & skills detection
    if (lower.includes('tailor') || lower.includes('தையல்') || lower.includes('सिलाई') || lower.includes('stitching') || lower.includes('कपड़े') || lower.includes('garment')) {
      updates.traditionalTrade = 'Tailoring';
      updates.currentOccupation = 'Tailor';
      updates.existingSkills = 'Machine sewing, garment alterations';
      setStep1Trade('Tailoring');
    } else if (lower.includes('solar') || lower.includes('மின்சாரம்') || lower.includes('सोलर') || lower.includes('electric') || lower.includes('बिजली')) {
      updates.traditionalTrade = 'Solar PV & Electrician';
      updates.currentOccupation = 'Electrician & Solar Installer';
      updates.existingSkills = 'Single phase wiring, solar panel mounting';
      setStep1Trade('Solar PV & Electrician');
    } else if (lower.includes('leather') || lower.includes('தோல்') || lower.includes('चमड़ा') || lower.includes('footwear') || lower.includes('जूता')) {
      updates.traditionalTrade = 'Leather Footwear & Goods';
      updates.currentOccupation = 'Footwear Craftsman';
      updates.existingSkills = 'Leather cutting, sole pasting, stitching';
      setStep1Trade('Leather Footwear & Goods');
    } else if (lower.includes('mechanic') || lower.includes('bike') || lower.includes('auto') || lower.includes('வாகனம்') || lower.includes('गाड़ी')) {
      updates.traditionalTrade = 'Two Wheeler & EV Mechanic';
      updates.currentOccupation = 'Automobile Mechanic';
      updates.existingSkills = 'Engine maintenance, electrical wiring';
      setStep1Trade('Two Wheeler & EV Mechanic');
    } else if (lower.includes('dairy') || lower.includes('பால்') || lower.includes('डेयरी') || lower.includes('गाय') || lower.includes('cattle')) {
      updates.traditionalTrade = 'Dairy & Food Processing';
      updates.currentOccupation = 'Dairy Farmer';
      updates.existingSkills = 'Milking, cattle nutrition, milk chilling';
      setStep1Trade('Dairy & Food Processing');
    } else if (lower.includes('mason') || lower.includes('கொத்தனார்') || lower.includes('मिस्त्री') || lower.includes('construction')) {
      updates.traditionalTrade = 'Construction & Masonry';
      updates.currentOccupation = 'Mason';
      updates.existingSkills = 'Bricklaying, plastering, tile fitting';
      setStep1Trade('Construction & Masonry');
    } else if (lower.includes('carpenter') || lower.includes('தச்சு') || lower.includes('बढ़ई') || lower.includes('wood')) {
      updates.traditionalTrade = 'Carpentry & Woodcraft';
      updates.currentOccupation = 'Carpenter';
      updates.existingSkills = 'Wood cutting, furniture assembly';
      setStep1Trade('Carpentry & Woodcraft');
    }

    // 3. District detection
    const districtMappings: Record<string, { district: string; state: string }> = {
      'madurai': { district: 'Madurai', state: 'Tamil Nadu' },
      'மதுரை': { district: 'Madurai', state: 'Tamil Nadu' },
      'tiruppur': { district: 'Tiruppur', state: 'Tamil Nadu' },
      'salem': { district: 'Salem', state: 'Tamil Nadu' },
      'chennai': { district: 'Chennai', state: 'Tamil Nadu' },
      'belagavi': { district: 'Belagavi', state: 'Karnataka' },
      'ಬೆಳಗಾವಿ': { district: 'Belagavi', state: 'Karnataka' },
      'mysuru': { district: 'Mysuru', state: 'Karnataka' },
      'warangal': { district: 'Warangal', state: 'Telangana' },
      'వరంగల్': { district: 'Warangal', state: 'Telangana' },
      'hyderabad': { district: 'Hyderabad', state: 'Telangana' },
      'palakkad': { district: 'Palakkad', state: 'Kerala' },
      'പാലക്കാട്': { district: 'Palakkad', state: 'Kerala' },
      'agra': { district: 'Agra', state: 'Uttar Pradesh' },
      'आगरा': { district: 'Agra', state: 'Uttar Pradesh' },
      'kanpur': { district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
      'varanasi': { district: 'Varanasi', state: 'Uttar Pradesh' },
    };
    for (const [key, loc] of Object.entries(districtMappings)) {
      if (lower.includes(key)) {
        updates.district = loc.district;
        updates.state = loc.state;
        setStep1District(loc.district);
        break;
      }
    }

    // 4. Pathway
    if (lower.includes('training') || lower.includes('course') || lower.includes('learn') || lower.includes('பயிற்சி') || lower.includes('ट्रेनिंग') || lower.includes('कोर्स') || lower.includes('శిక్షణ') || lower.includes('ತರಬೇತಿ')) {
      updates.preferredPathway = 'Skilling';
    } else if (lower.includes('job') || lower.includes('work') || lower.includes('வேலை') || lower.includes('नौकरी') || lower.includes('ఉద్యోగం') || lower.includes('ಕೆಲಸ')) {
      updates.preferredPathway = 'Employment';
    } else {
      updates.preferredPathway = 'Enterprise';
    }

    onUpdateProfile(updates);

    // AI model assisted extraction in parallel
    try {
      const aiExtracted = await aiService.extractProfileFromText(text, { ...userProfile, ...updates });
      if (aiExtracted && Object.keys(aiExtracted).length > 0) {
        onUpdateProfile(aiExtracted);
        if (aiExtracted.name) setStep1Name(aiExtracted.name);
        if (aiExtracted.traditionalTrade) setStep1Trade(aiExtracted.traditionalTrade);
        if (aiExtracted.district) setStep1District(aiExtracted.district);
      }
    } catch (e) {
      console.warn('AI extraction completed locally');
    } finally {
      setIsExtractingNeed(false);
    }
  };

  const handleApplyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setNeedInput(preset.text);
    setStep1District(preset.district);
    setStep1Trade(preset.trade);
    onUpdateProfile({
      goal: preset.text,
      traditionalTrade: preset.trade,
      currentOccupation: preset.trade,
      district: preset.district,
      state: preset.state,
      preferredPathway: preset.pathway,
    });
  };

  // Quick Direct Input Apply on Step 1
  const handleApplyStep1DirectInput = () => {
    const updates: Partial<BeneficiaryProfile> = {};
    if (step1Name.trim()) updates.name = step1Name.trim();
    if (step1Trade.trim()) {
      updates.traditionalTrade = step1Trade.trim();
      updates.currentOccupation = step1Trade.trim();
    }
    if (step1District.trim()) {
      updates.district = step1District.trim();
    }
    onUpdateProfile(updates);
  };

  // Add dynamic sample document to Document Intelligence
  const handleAddSampleDoc = (template: any) => {
    const existing = documents.find(d => d.docType === template.docType);
    if (existing) {
      alert(`${template.docType} is already attached to this application.`);
      return;
    }

    const newDoc = documentIntelligence.processDocument(template);
    newDoc.userConfirmed = true;
    newDoc.status = 'verified';

    const updatedDocs = [...documents, newDoc];
    setDocuments(updatedDocs);

    // Merge into shared citizen profile
    const updatedProfile = documentIntelligence.mergeConfirmedDocumentsToProfile(updatedDocs, userProfile);
    onUpdateProfile(updatedProfile);

    // Run discrepancy check
    const issues = documentIntelligence.auditDiscrepancies(updatedDocs, updatedProfile);
    setDiscrepancyList(issues);
  };

  // Add custom citizen uploaded document
  const handleAddCustomDocument = (e: React.FormEvent) => {
    e.preventDefault();
    const docFields: Record<string, string> = {
      'Document Type': customDocType,
      'Document Number': customDocNumber || `DOC-${Date.now().toString().slice(-6)}`,
      'Beneficiary Name': userProfile.name || 'Applicant',
      'Issuing Authority': customDocIssuer || `${userProfile.district || 'District'} Competent Authority`,
    };
    if (customDocType === 'Income Certificate') {
      docFields['Annual Family Income'] = customDocSpecialValue || userProfile.annualFamilyIncome || '₹75,000';
    } else if (customDocType === 'Bank Passbook') {
      docFields['Account Number'] = customDocSpecialValue || userProfile.bankAccountNumber || '38910482910';
      docFields['Bank Name'] = userProfile.bankName || 'State Bank of India';
      docFields['IFSC Code'] = userProfile.bankIfscCode || 'SBIN0001234';
    } else if (customDocType === 'Caste Certificate') {
      docFields['Social Category'] = userProfile.socialCategory || 'Scheduled Caste (SC)';
      docFields['Sub-Caste'] = userProfile.subCaste || customDocSpecialValue || 'SC';
    } else if (customDocType === 'Aadhaar Card') {
      docFields['Aadhaar Number'] = customDocNumber || userProfile.aadhaarNumber || 'XXXX-XXXX-4819';
      docFields['Address'] = userProfile.residentialAddress || `${userProfile.district}, ${userProfile.state}`;
    }

    const newDoc = documentIntelligence.processCustomUpload(
      customDocType,
      `${customDocType.replace(/\s+/g, '_')}_Verified.pdf`,
      docFields,
      98
    );
    const updatedDocs = [...documents, newDoc];
    setDocuments(updatedDocs);
    const updatedProfile = documentIntelligence.mergeConfirmedDocumentsToProfile(updatedDocs, userProfile);
    onUpdateProfile(updatedProfile);
    const issues = documentIntelligence.auditDiscrepancies(updatedDocs, updatedProfile);
    setDiscrepancyList(issues);
    setIsUploadDocModalOpen(false);
    setCustomDocNumber('');
    setCustomDocIssuer('');
    setCustomDocSpecialValue('');
  };

  // Save changes to document fields from inspect modal
  const handleSaveDocFieldChanges = () => {
    if (!previewDoc) return;
    const updatedDoc: DocumentRecord = {
      ...previewDoc,
      extractedFields: { ...editableDocFields },
      userConfirmed: true,
      status: 'verified',
    };
    const updatedList = documents.map(d => d.id === previewDoc.id ? updatedDoc : d);
    setDocuments(updatedList);
    const updatedProfile = documentIntelligence.mergeConfirmedDocumentsToProfile(updatedList, userProfile);
    onUpdateProfile(updatedProfile);
    setPreviewDoc(null);
  };

  // Handle saving an individual draft field edit from Step 5
  const handleSaveDraftFieldEdit = (fieldKey: string, newValue: string) => {
    const updates: Partial<BeneficiaryProfile> = {};
    if (fieldKey === 'applicant_name') updates.name = newValue;
    else if (fieldKey === 'aadhaar_no') updates.aadhaarNumber = newValue;
    else if (fieldKey === 'father_spouse_name') updates.fatherSpouseName = newValue;
    else if (fieldKey === 'caste_category') updates.socialCategory = newValue;
    else if (fieldKey === 'sub_caste') updates.subCaste = newValue;
    else if (fieldKey === 'annual_income') {
      updates.annualFamilyIncome = newValue;
      updates.householdIncome = newValue;
    }
    else if (fieldKey === 'ration_card_no') updates.bplRationCardNumber = newValue;
    else if (fieldKey === 'proposed_enterprise') {
      updates.traditionalTrade = newValue;
      updates.currentOccupation = newValue;
    }
    else if (fieldKey === 'bank_account_no') updates.bankAccountNumber = newValue;
    else if (fieldKey === 'bank_ifsc') {
      const parts = newValue.split('IFSC:');
      if (parts.length > 1) {
        updates.bankIfscCode = parts[1].trim();
      } else {
        updates.bankIfscCode = newValue;
      }
    }
    else if (fieldKey === 'residential_address') updates.residentialAddress = newValue;

    onUpdateProfile(updates);
    setEditingDraftField(null);
  };

  const handleRemoveDoc = (id: string) => {
    const updatedDocs = documents.filter(d => d.id !== id);
    setDocuments(updatedDocs);
    const issues = documentIntelligence.auditDiscrepancies(updatedDocs, userProfile);
    setDiscrepancyList(issues);
  };

  // Play narration of Kaushal Patra / Journey state
  const handleToggleAudioNarration = () => {
    if (isPlayingAudio) {
      aiService.stopAudio();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      const textToSpeak = roadmap?.audioNarrationScript || 
        `Welcome to UDAAN ONE. We have verified your profile for ${userProfile.name || 'beneficiary'} in ${userProfile.district || 'your district'}. You are eligible for the 50,000 rupees direct capital subsidy, 100 percent free NSQF skilling, and official toolkits.`;
      
      aiService.playSpeech(textToSpeak, langConfig.speechLocale).then(() => {
        setIsPlayingAudio(false);
      });
    }
  };

  const [consentWarning, setConsentWarning] = useState(false);
  const alertConsentNeeded = () => {
    setConsentWarning(true);
    setTimeout(() => setConsentWarning(false), 5000);
  };

  // Download the application preparation draft (PDF) via KaushalFill
  const handleDownloadApplicationPdf = () => {
    if (!applicationDraft) return;
    // Personal data leaves the screen only after explicit consent
    if (!citizenConsent) {
      alertConsentNeeded();
      return;
    }
    setIsDownloadingPdf(true);
    try {
      kaushalFillEngine.generateOfficialPdf(applicationDraft, userProfile);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const STEPS_NAV = [
    { num: 1, title: '1. Tell Need', desc: 'Voice / text request' },
    { num: 2, title: '2. Profile', desc: 'Consented data' },
    { num: 3, title: '3. Pathways', desc: 'Scheme intelligence' },
    { num: 4, title: '4. Documents', desc: 'OCR verification' },
    { num: 5, title: '5. KaushalFill', desc: 'Autofill & validate' },
    { num: 6, title: '6. Kaushal Patra', desc: 'Roadmap & delivery' },
  ];

  return (
    <div className="space-y-6">
      {consentWarning && (
        <div role="alert" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-2xl">
          Please review your details and tick the consent box in step 2 before downloading.
        </div>
      )}
      {/* Top Banner: One Intelligent Journey Concept */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/30 p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Unified Livelihood Journey</span>
              </span>
              <span className="text-xs text-slate-400">
                MoSJE PM-AJAY Grants-in-Aid (GIA)
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              From your need to a ready-to-file application
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl mt-1">
              One shared profile, preliminary scheme matching, document checks and guided drafting — you review everything before it is used.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAudioNarration}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md ${
                isPlayingAudio 
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{isPlayingAudio ? 'Stop Voice' : `Listen (${langConfig.nativeName})`}</span>
            </button>
            <button
              onClick={() => onGenerateRoadmap()}
              disabled={isGeneratingRoadmap}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isGeneratingRoadmap ? 'Analyzing...' : 'Generate Roadmap'}</span>
            </button>
          </div>
        </div>

        {/* State-Driven Stepper */}
        <div className="mt-6 pt-4 border-t border-indigo-500/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {STEPS_NAV.map((s) => {
            const isCurrent = currentStep === s.num;
            const isCompleted = currentStep > s.num;

            return (
              <button
                key={s.num}
                onClick={() => setCurrentStep(s.num)}
                className={`text-left p-2.5 rounded-xl border transition flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-lg ring-1 ring-indigo-400'
                    : isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold">
                    {s.title}
                  </span>
                  {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
                <span className="text-[10px] text-slate-300 truncate">
                  {s.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 1: Tell UDAAN ONE What You Need */}
      {currentStep === 1 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full mb-2">
                <span>Module 1</span>
                <span>•</span>
                <span>UDAAN ONE Voice Assistant</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Tell UDAAN ONE What You Need
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Speak or type in your language. The system extracts your trade, district, and livelihood goals.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
              Step 1 of 6
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Quick Test Personas (Click to Load Real Case):
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {QUICK_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(preset)}
                  className="text-left p-3 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-indigo-400/80 hover:bg-slate-800 transition group"
                >
                  <p className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200">
                    {preset.title}
                  </p>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                    "{preset.text}"
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Input Box with Voice & Text */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Your Goal or Question (Voice or Text):</span>
              <span className="text-[11px] text-emerald-400">Language: {langConfig.name} ({langConfig.nativeName})</span>
            </label>
            <div className="relative">
              <textarea
                value={needInput}
                onChange={(e) => setNeedInput(e.target.value)}
                placeholder="e.g. I am a tailor in Madurai. I want to expand my shop with government subsidy..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none pr-28"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  onClick={toggleVoiceInput}
                  className={`p-2.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition shadow ${
                    isListeningVoice
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                  title="Speak in your language"
                >
                  {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isListeningVoice ? 'Listening...' : 'Speak'}</span>
                </button>
                <button
                  onClick={() => extractIntentFromSpoken(needInput)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                  title="Submit text"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Extracted Needs summary */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-indigo-300">Extracted Focus:</span>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-md border border-slate-700">
                  Trade: <b className="text-white">{userProfile.traditionalTrade || 'Tailoring'}</b>
                </span>
                <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-md border border-slate-700">
                  District: <b className="text-white">{userProfile.district || 'Madurai'}</b>
                </span>
                <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-md border border-slate-700">
                  Pathway: <b className="text-emerald-400">{userProfile.preferredPathway || 'Enterprise'}</b>
                </span>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            >
              <span>Next: Confirm Citizen Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Understand the Citizen (Profile & Consent) */}
      {currentStep === 2 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 bg-indigo-400/10 px-2.5 py-1 rounded-full mb-2">
                <span>Module 1 & 2</span>
                <span>•</span>
                <span>Consented Citizen Profile</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Understand the Citizen & Privacy Consent
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Data used strictly for government scheme eligibility evaluation. Stored with full citizen consent and review controls.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
              Step 2 of 6
            </span>
          </div>

          {/* Privacy Consent Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-white">Digital Personal Data Protection (DPDP) Compliance</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              UDAAN ONE practices data minimization. Your information is processed locally and in private cloud runtimes only to match PM-AJAY schemes and fill your application forms. No data is sold or shared with commercial entities.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="consentCheck"
                checked={citizenConsent}
                onChange={(e) => {
                  setCitizenConsent(e.target.checked);
                  onUpdateProfile({ consentGranted: e.target.checked });
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
              <label htmlFor="consentCheck" className="text-xs font-semibold text-slate-200 cursor-pointer">
                I give consent to evaluate my eligibility for PM-AJAY GIA schemes and autofill application drafts.
              </label>
            </div>
          </div>

          {/* Editable Core Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Full Name (as per Aadhaar)</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => onUpdateProfile({ name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Social Category</label>
              <input
                type="text"
                value={userProfile.socialCategory || 'Scheduled Caste (SC)'}
                onChange={(e) => onUpdateProfile({ socialCategory: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Sub-Caste (if known)</label>
              <input
                type="text"
                value={userProfile.subCaste || 'Adi Dravidar'}
                onChange={(e) => onUpdateProfile({ subCaste: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">District</label>
              <input
                type="text"
                value={userProfile.district}
                onChange={(e) => onUpdateProfile({ district: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">State</label>
              <input
                type="text"
                value={userProfile.state}
                onChange={(e) => onUpdateProfile({ state: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Age</label>
              <input
                type="number"
                value={userProfile.age}
                onChange={(e) => onUpdateProfile({ age: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Traditional Trade / Craft</label>
              <input
                type="text"
                value={userProfile.traditionalTrade || userProfile.currentOccupation}
                onChange={(e) => onUpdateProfile({ traditionalTrade: e.target.value, currentOccupation: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Annual Family Income</label>
              <input
                type="text"
                value={userProfile.annualFamilyIncome || userProfile.householdIncome || '₹72,000'}
                onChange={(e) => onUpdateProfile({ annualFamilyIncome: e.target.value, householdIncome: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Livelihood Preference</label>
              <select
                value={userProfile.workPreference}
                onChange={(e: any) => onUpdateProfile({ workPreference: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Self-Employment / Micro-enterprise">Self-Employment / Micro-enterprise</option>
                <option value="Wage Employment">Wage Employment</option>
                <option value="SHG Group Business">SHG Group Business</option>
                <option value="Any">Any</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Tell Need</span>
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            >
              <span>Next: Evaluate Scheme Intelligence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Scheme Intelligence & Skill Pathways */}
      {currentStep === 3 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full mb-2">
                <span>Module 2 & 3</span>
                <span>•</span>
                <span>Deterministic Scheme Intelligence Engine</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Scheme & Skill Pathway Matching (preliminary)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Deterministic rule engine matches your profile against verified government gazette rules with official circular citations.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
              Step 3 of 6
            </span>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['All', 'Grant Subsidy', 'Skill Stipend', 'Toolkit Support', 'Concessional Loan'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedSchemeFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  selectedSchemeFilter === cat
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Scheme Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schemeMatches
              .filter(s => selectedSchemeFilter === 'All' || s.category === selectedSchemeFilter)
              .map((scheme) => (
                <div
                  key={scheme.schemeId}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                          {scheme.category}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-0.5">
                          {scheme.name}
                        </h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          scheme.eligibilityStatus === 'Eligible'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {scheme.matchScore}% Match
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {scheme.eligibilityStatus === 'Eligible' ? 'Likely eligible' : scheme.eligibilityStatus} · preliminary
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                      {scheme.officialBenefit}
                    </p>

                    <div className="space-y-1 text-[11px]">
                      <div className="text-emerald-400 flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Matched: {scheme.matchedCriteria.join('; ')}</span>
                      </div>
                      {scheme.missingCriteria.length > 0 && (
                        <div className="text-amber-400 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Action needed: {scheme.missingCriteria.join('; ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate max-w-[200px]" title={scheme.circularRef}>
                      📜 {scheme.circularRef}
                    </span>
                    <a
                      href={scheme.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold shrink-0"
                    >
                      <span>Official Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Profile</span>
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            >
              <span>Next: Document Intelligence (OCR)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Document Intelligence (OCR & Verification) */}
      {currentStep === 4 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 bg-purple-400/10 px-2.5 py-1 rounded-full mb-2">
                <span>Module 4</span>
                <span>•</span>
                <span>Document Intelligence & Discrepancy Auditor</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Scan & Verify Government Documents
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Attach official government documents. The OCR engine extracts fields with confidence scoring and checks for identity discrepancies.
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
              Step 4 of 6
            </span>
          </div>

          {/* Discrepancy Warnings */}
          {discrepancyList.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Document Cross-Verification Audit:</span>
              </div>
              {discrepancyList.map((issue, idx) => (
                <p key={idx} className="text-[11px] text-amber-200/90 pl-5">
                  • {issue}
                </p>
              ))}
            </div>
          )}

          {/* Quick Sample Document Inserter */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              1-Tap Attach Sample Government Documents:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {getTemplatesForProfile(userProfile).map((tmpl: SampleDocumentTemplate) => {
                const isAttached = documents.some(d => d.docType === tmpl.docType);
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleAddSampleDoc(tmpl)}
                    disabled={isAttached}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition ${
                      isAttached
                        ? 'bg-emerald-950/30 border-emerald-500/40 opacity-70 cursor-default'
                        : 'bg-slate-950 border-slate-800 hover:border-indigo-500/60 hover:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <FileCheck className={`w-4 h-4 ${isAttached ? 'text-emerald-400' : 'text-indigo-400'}`} />
                        {isAttached && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">Attached</span>}
                      </div>
                      <span className="text-xs font-bold text-white block">
                        {tmpl.docType}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block">
                      {tmpl.confidence}% Confidence
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Currently Attached Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Verified Documents Attached ({documents.length} of 5):
              </span>
              <span className="text-xs text-slate-400">
                Extracted fields are automatically applied to your official application.
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center text-slate-400 text-xs">
                No documents attached yet. Click on any of the sample documents above to simulate instant OCR extraction.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{doc.docType}</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                          ✓ {doc.confidence}% Confidence
                        </span>
                        <span className="text-[10px] text-slate-400">{doc.fileName}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 pt-1">
                        {Object.entries(doc.extractedFields).slice(0, 3).map(([k, v]) => (
                          <span key={k} className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {k}: <b className="text-white">{v}</b>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Fields</span>
                      </button>
                      <button
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400"
                        title="Remove document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Schemes</span>
            </button>
            <button
              onClick={() => setCurrentStep(5)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            >
              <span>Next: KaushalFill Application Engine</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: KaushalFill Application Engine */}
      {currentStep === 5 && applicationDraft && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full mb-2">
                <span>Module 5</span>
                <span>•</span>
                <span>KaushalFill Automated Application Engine</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                PM-AJAY application draft — review before use
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your verified profile and scanned documents have been mapped into the official MoSJE Form GIA-IGS-2025.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 font-bold">
                {applicationDraft.completionPercentage}% Validated
              </span>
            </div>
          </div>

          {/* Form Header Info Bar */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">
                {applicationDraft.formName}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Submit to: {applicationDraft.nodalAuthority} · This draft helps you fill the official form
              </span>
            </div>
            <button
              onClick={handleDownloadApplicationPdf}
              disabled={isDownloadingPdf}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download draft PDF'}</span>
            </button>
          </div>

          {/* Validation Report */}
          {applicationDraft.validationErrors.length > 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
              <span className="font-bold block">Validation Warnings before submission:</span>
              {applicationDraft.validationErrors.map((err, idx) => (
                <p key={idx} className="text-[11px] text-amber-200/90 pl-3">
                  • {err}
                </p>
              ))}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>100% Validated: All mandatory KYC, community, income, and bank fields satisfy official submission rules!</span>
            </div>
          )}

          {/* Form Fields Table View */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Autofilled Application Field</span>
              <span>Extracted Value & Source</span>
            </div>
            <div className="divide-y divide-slate-800/80 text-xs max-h-96 overflow-y-auto">
              {applicationDraft.fields.map((f) => (
                <div key={f.key} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-950/40">
                  <div className="space-y-0.5">
                    <span className="font-medium text-slate-300">{f.label}</span>
                    <span className="text-[10px] text-slate-500 block">{f.section}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                      {f.value || 'Not provided'}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      f.source === 'document' 
                        ? 'bg-purple-500/20 text-purple-300' 
                        : f.source === 'profile'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {f.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Official Submission Destination Box */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              <span>Where to submit the official application:</span>
            </span>
            <div className="text-xs text-slate-300 space-y-0.5">
              <p><b>Designated Office:</b> {applicationDraft.submissionOffice.name}</p>
              <p><b>Address:</b> {applicationDraft.submissionOffice.address}</p>
              <p><b>Nodal Officer:</b> {applicationDraft.submissionOffice.officer} (Helpline: {applicationDraft.submissionOffice.contactPhone})</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: Documents</span>
            </button>
            <button
              onClick={() => setCurrentStep(6)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
            >
              <span>Next: Deliver Kaushal Patra</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Deliver Kaushal Patra */}
      {currentStep === 6 && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full mb-2">
                <span>Module 6</span>
                <span>•</span>
                <span>Final Output: Kaushal Patra Livelihood Roadmap</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Personalized Kaushal Patra & Action Plan
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your unified roadmap combines recommendations, NSQF course, capital subsidy, bank linkages, document checklist, and official district contacts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleAudioNarration}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                  isPlayingAudio ? 'bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                <span>{isPlayingAudio ? 'Stop Voice' : 'Spoken Roadmap'}</span>
              </button>
              <button
                onClick={onOpenKaushalPatraModal}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg transition"
              >
                <FileText className="w-4 h-4" />
                <span>Open Kaushal Patra</span>
              </button>
            </div>
          </div>

          {/* Roadmap Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-indigo-400">
                <Award className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">NSQF Skill Pathway</span>
              </div>
              <p className="text-sm font-bold text-white">
                Self-Employed Tailor (Level 4)
              </p>
              <p className="text-xs text-slate-400">
                Free training under PMKVY / PM-DAKSH • RPL for existing skills • stipend where the programme offers one.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <Coins className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Capital & Funding</span>
              </div>
              <p className="text-sm font-bold text-white">
                PM-AJAY grant + bank loan
              </p>
              <p className="text-xs text-slate-400">
                Grant as per PM-AJAY guidelines, with the rest through MUDRA or NSFDC loans.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Briefcase className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Artisan Toolkit</span>
              </div>
              <p className="text-sm font-bold text-white">
                Toolkit support (where offered)
              </p>
              <p className="text-xs text-slate-400">
                Some programmes, like PM Vishwakarma, provide toolkit support after training.
              </p>
            </div>
          </div>

          {/* Step-by-Step Next Actions */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              Citizen Next Steps to Complete Subsidy Receipt:
            </span>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                <div>
                  <b className="text-white">Download the KaushalFill PDF:</b> Click the button below to save your filled official Form GIA-IGS-2025.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                <div>
                  <b className="text-white">Attach Verified Enclosures:</b> Keep 1 copy of your Aadhaar, SC Community Certificate, Income Certificate, and Bank Passbook.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                <div>
                  <b className="text-white">Visit Nodal District Office:</b> Visit Room 104, Collectorate Complex, {userProfile.district || 'Madurai'} for instant biometric seal & submission.
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(5)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back: KaushalFill</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadApplicationPdf}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download draft PDF</span>
              </button>
              <button
                onClick={onOpenKaushalPatraModal}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition"
              >
                <Award className="w-4 h-4" />
                <span>Open & Print Kaushal Patra</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Document Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">{previewDoc.docType}</h4>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                OCR Extracted Key-Values ({previewDoc.confidence}% Accuracy):
              </span>
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                {Object.entries(previewDoc.extractedFields).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-slate-400">{k}:</span>
                    <span className="font-bold text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setPreviewDoc(null)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
            >
              Confirm & Return to Workflow
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
