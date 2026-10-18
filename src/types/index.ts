export type ChannelMode =
  | 'home'
  | 'schemes'
  | 'skills'
  | 'enterprise'
  | 'applications'
  | 'smart_apply'
  | 'documents'
  | 'unified_journey'
  | 'voice_studio'
  | 'kiosk'
  | 'whatsapp'
  | 'ivr'
  | 'district_map';

export type LanguageCode = 
  | 'hi' // Hindi
  | 'en' // English
  | 'bn' // Bengali
  | 'te' // Telugu
  | 'mr' // Marathi
  | 'ta' // Tamil
  | 'gu' // Gujarati
  | 'kn' // Kannada
  | 'pa' // Punjabi
  | 'or' // Odia
  | 'ml' // Malayalam
  | 'ur'; // Urdu

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  speechLocale: string;
  flag: string;
  sampleGreeting: string;
}

export interface BeneficiaryProfile {
  name: string;
  age: number | string;
  gender: 'Male' | 'Female' | 'Transgender' | 'Prefer not to say';
  state: string;
  district: string;
  education: string;
  currentOccupation: string;
  traditionalTrade: string;
  existingSkills: string;
  mobilityConstraint: string;
  workPreference: 'Wage Employment' | 'Self-Employment / Micro-enterprise' | 'SHG Group Business' | 'Any';
  householdIncome: string;
  hasSmartphone: boolean;
  disabilityStatus: 'None' | 'Locomotor' | 'Visual' | 'Hearing' | 'Other';
  goal?: string;
  preferredPathway?: 'Skilling' | 'Employment' | 'Enterprise';
  socialCategory?: string;
  subCaste?: string;
  aadhaarNumber?: string;
  fatherSpouseName?: string;
  dateOfBirth?: string;
  residentialAddress?: string;
  pincode?: string;
  phoneNumber?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  bankName?: string;
  annualFamilyIncome?: string;
  bplRationCardNumber?: string;
  consentGranted?: boolean;
}

export interface NsqfCourse {
  id: string;
  jobRole: string;
  qpCode: string;
  nsqfLevel: string;
  sector: string;
  durationHours: string;
  stipendSupported: boolean;
  whyFit: string;
  iconName?: string;
  prerequisites?: string;
  certifyingBody?: string;
}

export interface LivelihoodAnalysis {
  profileSummary: string;
  nsqfCourses: NsqfCourse[];
  skillGapAnalysis: {
    strengthsIdentified: string[];
    missingGaps: string[];
  };
  livelihoodPathways: {
    wageEmployment: {
      expectedSalary: string;
      targetEmployers: string[];
      timeline: string;
    };
    selfEmployment: {
      businessConcept: string;
      projectCost: string;
      pmAjayGiaSubsidy: string;
      bankLoanMudra: string;
      equipmentToolkit: string;
      monthlyProfitPotential: string;
    };
  };
  localClusterLinkage: string;
  audioNarrationScript: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  audioBase64?: string;
  isAudioPlaying?: boolean;
  suggestedPills?: string[];
}

export interface DistrictCluster {
  state: string;
  district: string;
  scPopulationPercent: number;
  traditionalCrafts: string[];
  growingIndustries: string[];
  giaApprovedTCCount: number;
  highlightScheme: string;
}

export interface VerifiedSchemeMatch {
  schemeId: string;
  name: string;
  shortName: string;
  category: 'Grant Subsidy' | 'Concessional Loan' | 'Skill Stipend' | 'Toolkit Support';
  officialBenefit: string;
  maxFinancialValue?: string;
  circularRef: string;
  officialSourceUrl: string;
  nodalDepartment: string;
  deadlineInfo: string;
  matchScore: number;
  eligibilityStatus: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible';
  matchedCriteria: string[];
  missingCriteria: string[];
}

export interface DocumentRecord {
  id: string;
  docType: 'Aadhaar Card' | 'Caste Certificate' | 'Income Certificate' | 'Bank Passbook' | 'Ration Card' | 'Skill Certificate' | 'Other Document';
  fileName: string;
  status: 'verified' | 'needs_review' | 'rejected';
  confidence: number;
  extractedFields: Record<string, string>;
  discrepancies: string[];
  userConfirmed: boolean;
  uploadedAt: string;
}

export interface FormFieldItem {
  key: string;
  label: string;
  value: string;
  required: boolean;
  status: 'valid' | 'missing' | 'warning';
  source: 'profile' | 'document' | 'manual';
  section: string;
}

export interface ApplicationDraft {
  id: string;
  schemeId: string;
  formName: string;
  formCode: string;
  nodalAuthority: string;
  status: 'draft' | 'validated' | 'submitted';
  completionPercentage: number;
  fields: FormFieldItem[];
  validationErrors: string[];
  citizenApproved: boolean;
  lastUpdated: string;
  submissionOffice: {
    name: string;
    address: string;
    officer: string;
    contactPhone: string;
    onlinePortalUrl: string;
  };
}

