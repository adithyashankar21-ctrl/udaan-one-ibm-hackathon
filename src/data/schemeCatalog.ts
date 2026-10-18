import { BeneficiaryProfile } from '../types';

export type SchemeFilter = 'skilling' | 'employment' | 'education' | 'livelihood' | 'entrepreneurship';

export interface CatalogScheme {
  id: string;
  name: string;
  ministry: string;
  filters: SchemeFilter[];
  summary: string;
  /** Headline support, kept to well-established public facts. Always confirm on the official portal. */
  keySupport: string[];
  /** Plain-language eligibility summary (not an official determination). */
  eligibilitySummary: string;
  documents: string[];
  steps: string[];
  officialUrl: string;
  officialLabel: string;
  /** How broadly useful the scheme is for a typical livelihood roadmap (higher first). */
  roadmapPriority: number;
  /** Rules that drive the preliminary, non-official eligibility estimate. */
  rules: {
    minAge?: number;
    maxAge?: number;
    scOnly?: boolean;
    maxAnnualIncome?: number;
  };
}

/**
 * Scheme summaries for discovery. These are simplified descriptions of public schemes.
 * Benefits, limits and deadlines change; the UI must always point users to the official
 * portal and must never present this content as an official eligibility decision.
 */
export const SCHEME_CATALOG: CatalogScheme[] = [
  {
    id: 'pm-ajay',
    name: 'PM-AJAY (Pradhan Mantri Anusuchit Jaati Abhyuday Yojana)',
    ministry: 'Ministry of Social Justice & Empowerment',
    filters: ['livelihood', 'skilling', 'entrepreneurship'],
    summary:
      'Supports Scheduled Caste communities through grants for income-generating assets, skill development and village infrastructure, implemented by State governments.',
    keySupport: [
      'Grant support for income-generating assets for SC individuals or households',
      'Skill development projects implemented through the State',
    ],
    eligibilitySummary: 'Scheduled Caste individuals and households, as selected by the State / District implementing agency.',
    documents: ['Aadhaar card', 'Caste certificate (SC)', 'Income certificate', 'Bank passbook', 'Passport-size photo'],
    steps: [
      'Contact the District Social Welfare Office or State SC Development Corporation',
      'Submit the application with documents',
      'Verification by the district office',
      'Sanction and release of assistance',
    ],
    officialUrl: 'https://pmajay.dosje.gov.in',
    officialLabel: 'pmajay.dosje.gov.in',
    roadmapPriority: 5,
    rules: { scOnly: true, minAge: 18 },
  },
  {
    id: 'pm-daksh',
    name: 'PM-DAKSH (Skill Development for target groups)',
    ministry: 'Ministry of Social Justice & Empowerment',
    filters: ['skilling', 'employment'],
    summary: 'Free skill training programmes — up-skilling, re-skilling, short-term training and entrepreneurship development — for marginalised groups including SCs.',
    keySupport: ['Free training in job-oriented courses', 'Certification after assessment'],
    eligibilitySummary: 'Members of the notified target groups (including Scheduled Castes) within the age and income limits set by the scheme.',
    documents: ['Aadhaar card', 'Caste certificate', 'Income certificate', 'Educational certificates'],
    steps: ['Register on the PM-DAKSH portal', 'Choose a course and training centre', 'Attend training', 'Take the assessment and receive certificate'],
    officialUrl: 'https://pmdaksh.dosje.gov.in',
    officialLabel: 'pmdaksh.dosje.gov.in',
    roadmapPriority: 4,
    rules: { minAge: 18 },
  },
  {
    id: 'pmkvy',
    name: 'Pradhan Mantri Kaushal Vikas Yojana (PMKVY)',
    ministry: 'Ministry of Skill Development & Entrepreneurship',
    filters: ['skilling', 'employment'],
    summary: 'Free short-term skill training and Recognition of Prior Learning (RPL) for people who already have informal skills.',
    keySupport: ['Free NSQF-aligned short-term training', 'Recognition of Prior Learning for existing skills', 'Government-recognised certificate'],
    eligibilitySummary: 'Indian citizens of working age; course-specific education requirements apply.',
    documents: ['Aadhaar card', 'Bank account details', 'Educational certificates (if required by course)'],
    steps: ['Register on Skill India Digital Hub', 'Pick a course and nearby centre', 'Complete training', 'Pass the assessment to be certified'],
    officialUrl: 'https://www.skillindiadigital.gov.in',
    officialLabel: 'skillindiadigital.gov.in',
    roadmapPriority: 4,
    rules: { minAge: 15 },
  },
  {
    id: 'pm-vishwakarma',
    name: 'PM Vishwakarma',
    ministry: 'Ministry of Micro, Small & Medium Enterprises',
    filters: ['skilling', 'entrepreneurship', 'livelihood'],
    summary: 'Support for traditional artisans and craftspeople in notified trades (e.g. tailor, cobbler, carpenter, potter, blacksmith).',
    keySupport: ['Recognition through PM Vishwakarma certificate and ID', 'Skill training with stipend', 'Toolkit incentive', 'Collateral-free credit at concessional interest'],
    eligibilitySummary: 'Artisans aged 18+ working with hands and tools in one of the notified family-based trades.',
    documents: ['Aadhaar card', 'Mobile number linked to Aadhaar', 'Bank account details', 'Ration card (if available)'],
    steps: ['Register through a Common Service Centre (CSC)', 'Verification at Gram Panchayat / ULB level', 'Attend basic skill training', 'Apply for toolkit and credit support'],
    officialUrl: 'https://pmvishwakarma.gov.in',
    officialLabel: 'pmvishwakarma.gov.in',
    roadmapPriority: 4,
    rules: { minAge: 18 },
  },
  {
    id: 'mudra',
    name: 'Pradhan Mantri MUDRA Yojana',
    ministry: 'Department of Financial Services, Ministry of Finance',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'Collateral-free loans for micro and small non-farm businesses through banks, NBFCs and MFIs.',
    keySupport: ['Shishu: loans up to ₹50,000', 'Kishore: ₹50,000 to ₹5 lakh', 'Tarun: higher limits for growing businesses'],
    eligibilitySummary: 'Individuals or small businesses with a viable non-farm income-generating activity.',
    documents: ['Aadhaar / identity proof', 'Address proof', 'Business plan or quotation', 'Bank statement', 'Photo'],
    steps: ['Prepare a simple business plan', 'Approach a bank, NBFC or MFI (or apply online)', 'Bank appraisal', 'Loan sanction'],
    officialUrl: 'https://www.mudra.org.in',
    officialLabel: 'mudra.org.in',
    roadmapPriority: 4,
    rules: { minAge: 18 },
  },
  {
    id: 'nsfdc',
    name: 'NSFDC loans (National Scheduled Castes Finance & Development Corporation)',
    ministry: 'Ministry of Social Justice & Empowerment',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'Concessional loans for income-generating activities of Scheduled Caste persons, routed through State Channelising Agencies.',
    keySupport: ['Term loans and micro-credit at concessional interest', 'Schemes for women entrepreneurs'],
    eligibilitySummary: 'Scheduled Caste persons within the family income limit notified by NSFDC.',
    documents: ['Caste certificate (SC)', 'Income certificate', 'Aadhaar card', 'Project report', 'Bank details'],
    steps: ['Contact your State Channelising Agency (SC Development Corporation)', 'Submit the project proposal', 'Appraisal and sanction', 'Disbursement'],
    officialUrl: 'https://nsfdc.nic.in',
    officialLabel: 'nsfdc.nic.in',
    roadmapPriority: 3,
    rules: { scOnly: true, minAge: 18, maxAnnualIncome: 300000 },
  },
  {
    id: 'stand-up-india',
    name: 'Stand-Up India',
    ministry: 'Department of Financial Services, Ministry of Finance',
    filters: ['entrepreneurship'],
    summary: 'Bank loans for SC/ST and women entrepreneurs setting up a new (greenfield) enterprise.',
    keySupport: ['Bank loans from ₹10 lakh up to ₹1 crore', 'Hand-holding support through the portal'],
    eligibilitySummary: 'SC/ST and/or women entrepreneurs aged 18+ starting a new enterprise.',
    documents: ['Identity and address proof', 'Caste certificate (if SC/ST)', 'Project report', 'Bank statements'],
    steps: ['Register on the Stand-Up Mitra portal', 'Connect with a bank branch', 'Submit project details', 'Loan appraisal and sanction'],
    officialUrl: 'https://www.standupmitra.in',
    officialLabel: 'standupmitra.in',
    roadmapPriority: 1,
    rules: { minAge: 18 },
  },
  {
    id: 'post-matric-sc',
    name: 'Post-Matric Scholarship for SC Students',
    ministry: 'Ministry of Social Justice & Empowerment',
    filters: ['education'],
    summary: 'Scholarships for Scheduled Caste students studying after Class 10, including ITI and polytechnic courses.',
    keySupport: ['Course fees and maintenance allowance as per scheme norms'],
    eligibilitySummary: 'SC students in post-matric courses whose family income is within the notified limit.',
    documents: ['Caste certificate', 'Income certificate', 'Previous marksheet', 'Admission proof', 'Aadhaar-seeded bank account'],
    steps: ['Apply on the National Scholarship Portal or State portal', 'Institute verification', 'District / State verification', 'Payment to bank account'],
    officialUrl: 'https://scholarships.gov.in',
    officialLabel: 'scholarships.gov.in',
    roadmapPriority: 0,
    rules: { scOnly: true },
  },
  {
    id: 'ncs',
    name: 'National Career Service',
    ministry: 'Ministry of Labour & Employment',
    filters: ['employment'],
    summary: 'Free job portal with job listings, job fairs and career counselling.',
    keySupport: ['Search jobs and job fairs', 'Career counselling'],
    eligibilitySummary: 'Open to all job seekers.',
    documents: ['Mobile number', 'Identity proof', 'Educational details'],
    steps: ['Register on the NCS portal', 'Complete your profile', 'Search and apply for jobs'],
    officialUrl: 'https://www.ncs.gov.in',
    officialLabel: 'ncs.gov.in',
    roadmapPriority: 2,
    rules: {},
  },
];

export type EligibilityLevel = 'likely' | 'needs-info' | 'unlikely';

export interface EligibilityEstimate {
  level: EligibilityLevel;
  reasons: string[];
}

function parseIncome(value?: string): number | null {
  if (!value) return null;
  const digits = value.replace(/[^0-9.]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  if (!isFinite(n)) return null;
  // Values entered in lakh (e.g. "2.5 lakh")
  return /lakh|lac/i.test(value) ? n * 100000 : n;
}

/**
 * Preliminary, rule-of-thumb estimate from the user's own profile.
 * It is NOT an official eligibility decision.
 */
export function estimateEligibility(scheme: CatalogScheme, profile: BeneficiaryProfile): EligibilityEstimate {
  const reasons: string[] = [];
  let unlikely = false;
  let missing = false;

  const age = typeof profile.age === 'number' ? profile.age : parseInt(String(profile.age || ''), 10);
  if (scheme.rules.minAge !== undefined || scheme.rules.maxAge !== undefined) {
    if (isNaN(age)) {
      missing = true;
      reasons.push('Add your age to check the age limit');
    } else if (scheme.rules.minAge !== undefined && age < scheme.rules.minAge) {
      unlikely = true;
      reasons.push(`Minimum age is ${scheme.rules.minAge}`);
    } else if (scheme.rules.maxAge !== undefined && age > scheme.rules.maxAge) {
      unlikely = true;
      reasons.push(`Maximum age is ${scheme.rules.maxAge}`);
    } else {
      reasons.push(`Your age (${age}) fits the age requirement`);
    }
  }

  if (scheme.rules.scOnly) {
    const cat = profile.socialCategory || '';
    if (!cat) {
      missing = true;
      reasons.push('Add your social category');
    } else if (/SC|Scheduled Caste/i.test(cat)) {
      reasons.push('For Scheduled Caste applicants — matches your profile');
    } else {
      unlikely = true;
      reasons.push('This scheme is for Scheduled Caste applicants');
    }
  }

  if (scheme.rules.maxAnnualIncome !== undefined) {
    const income = parseIncome(profile.annualFamilyIncome);
    if (income === null) {
      missing = true;
      reasons.push('Add your annual family income');
    } else if (income > scheme.rules.maxAnnualIncome) {
      unlikely = true;
      reasons.push('Family income may be above the scheme limit');
    } else {
      reasons.push('Family income appears within the limit');
    }
  }

  if (reasons.length === 0) reasons.push('Open to most applicants — check course or job requirements');

  return { level: unlikely ? 'unlikely' : missing ? 'needs-info' : 'likely', reasons };
}

/**
 * Schemes most relevant to a person's roadmap: preliminary eligibility first, then fit
 * with what they are looking for (job vs business), then general usefulness.
 */
export function rankSchemesForProfile(profile: BeneficiaryProfile, savedIds: string[] = [], limit = 4) {
  const wantsBusiness = /Self-Employment|SHG/i.test(profile.workPreference || '') || profile.preferredPathway === 'Enterprise';
  const wantsJob = /Wage/i.test(profile.workPreference || '') || profile.preferredPathway === 'Employment';
  const age = Number(profile.age);
  const student = /12th|Graduate/i.test(profile.education || '') && age > 0 && age <= 25;

  return SCHEME_CATALOG.map((s) => {
    const e = estimateEligibility(s, profile);
    let score = s.roadmapPriority;
    if (e.level === 'likely') score += 3;
    if (e.level === 'unlikely') score -= 10;
    if (savedIds.includes(s.id)) score += 4;
    if (wantsBusiness && s.filters.includes('entrepreneurship')) score += 2;
    if (wantsJob && s.filters.includes('employment')) score += 2;
    if (s.filters.length === 1 && s.filters[0] === 'education' && !student) score -= 6;
    return { s, e, score };
  })
    .filter((x) => x.e.level !== 'unlikely')
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
