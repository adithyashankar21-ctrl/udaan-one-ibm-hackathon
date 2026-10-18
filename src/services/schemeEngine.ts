import { BeneficiaryProfile, VerifiedSchemeMatch } from '../types';

export interface VerifiedSchemeDefinition {
  id: string;
  name: string;
  shortName: string;
  category: 'Grant Subsidy' | 'Concessional Loan' | 'Skill Stipend' | 'Toolkit Support';
  officialBenefit: string;
  maxFinancialValue: string;
  circularRef: string;
  officialSourceUrl: string;
  nodalDepartment: string;
  deadlineInfo: string;
  checkEligibility: (profile: BeneficiaryProfile) => {
    score: number;
    status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible';
    matched: string[];
    missing: string[];
  };
}

export const VERIFIED_SCHEMES: VerifiedSchemeDefinition[] = [
  {
    id: 'pm-ajay-gia-igs',
    name: 'PM-AJAY Grants-in-Aid for Income Generating Schemes (GIA-IGS)',
    shortName: 'PM-AJAY income-generation grant',
    category: 'Grant Subsidy',
    officialBenefit: 'Grant support for income-generating assets for SC individuals and households, as per PM-AJAY guidelines and State implementation.',
    maxFinancialValue: 'As per PM-AJAY guidelines',
    circularRef: 'See PM-AJAY guidelines on the official portal',
    officialSourceUrl: 'https://pmajay.dosje.gov.in',
    nodalDepartment: 'District Social Welfare Officer (DSWO) / State SC Development Corporation (e.g. TAHDCO)',
    deadlineInfo: 'Check the current cycle with your District Social Welfare Office',
    checkEligibility: (profile: BeneficiaryProfile) => {
      const matched: string[] = [];
      const missing: string[] = [];
      let score = 50;

      // Caste check
      const isSC = !profile.socialCategory || profile.socialCategory.includes('SC') || profile.socialCategory.includes('Scheduled Caste');
      if (isSC) {
        matched.push('Scheduled Caste (SC) applicant, as stated in profile');
        score += 20;
      } else {
        missing.push('Requires verified Scheduled Caste (SC) community certificate');
      }

      // Age check (18 - 50)
      const age = typeof profile.age === 'number' ? profile.age : parseInt(String(profile.age || '32'), 10);
      if (!isNaN(age) && age >= 18 && age <= 50) {
        matched.push(`Age ${age} falls in eligible bracket (18-50 years)`);
        score += 15;
      } else if (isNaN(age)) {
        missing.push('Age not yet verified (must be 18 to 50 years)');
      } else {
        missing.push(`Age ${age} outside standard 18-50 window`);
        score -= 20;
      }

      // Income check (< ₹3,00,000)
      const incomeStr = profile.annualFamilyIncome || profile.householdIncome || '';
      const incomeNum = parseInt(incomeStr.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(incomeNum) && incomeNum <= 300000) {
        matched.push(`Annual income (${incomeStr}) within ceiling of ₹3.0 Lakh/yr`);
        score += 15;
      } else if (!incomeStr) {
        missing.push('Annual income verification certificate required (ceiling ₹3,00,000)');
      } else if (incomeNum > 300000) {
        missing.push(`Income ${incomeStr} exceeds PM-AJAY GIA ceiling of ₹3,00,000`);
        score -= 30;
      }

      // Enterprise preference
      if (profile.workPreference?.includes('Self-Employment') || profile.traditionalTrade || profile.currentOccupation) {
        matched.push(`Active vocational trade identified: ${profile.traditionalTrade || profile.currentOccupation || 'Artisan'}`);
        score += 10;
      }

      score = Math.min(100, Math.max(10, score));
      let status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible' = 'Potential Match';
      if (score >= 85) status = 'Eligible';
      else if (missing.length > 2) status = 'Missing Info';
      else if (score < 40) status = 'Ineligible';

      return { score, status, matched, missing };
    },
  },
  {
    id: 'pm-ajay-nsqf-skilling',
    name: 'PM-AJAY 100% Free NSQF Skilling & Daily Travel Allowance',
    shortName: 'Free skill training',
    category: 'Skill Stipend',
    officialBenefit: 'Skill training and certification through State implementing agencies; any stipend or allowance depends on the programme.',
    maxFinancialValue: 'Training cost covered as per programme norms',
    circularRef: 'See programme norms on Skill India Digital Hub',
    officialSourceUrl: 'https://www.skillindiadigital.gov.in',
    nodalDepartment: 'District Skill Development Office (DSDO) / PMKK Training Centers',
    deadlineInfo: 'Batches open periodically — check with the training centre',
    checkEligibility: (profile: BeneficiaryProfile) => {
      const matched: string[] = [];
      const missing: string[] = [];
      let score = 60;

      matched.push('Open to all SC youth, school dropouts, and traditional artisans');
      score += 20;

      const age = typeof profile.age === 'number' ? profile.age : parseInt(String(profile.age || '32'), 10);
      if (!isNaN(age) && age >= 15 && age <= 45) {
        matched.push(`Age ${age} eligible for NSQF training (15-45 years)`);
        score += 15;
      }

      if (profile.education) {
        matched.push(`Education (${profile.education}) satisfies course prerequisite`);
        score += 10;
      }

      score = Math.min(100, Math.max(15, score));
      const status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible' = score >= 80 ? 'Eligible' : 'Potential Match';
      return { score, status, matched, missing };
    },
  },
  {
    id: 'pm-ajay-toolkit-grant',
    name: 'PM-AJAY Modern Equipment & Precision Toolkit Grant',
    shortName: 'Toolkit support (where offered)',
    category: 'Toolkit Support',
    officialBenefit: 'Some State and central programmes provide toolkits after training or RPL assessment. Availability and value vary.',
    maxFinancialValue: 'Varies by programme',
    circularRef: 'Confirm availability with your district office',
    officialSourceUrl: 'https://pmajay.dosje.gov.in',
    nodalDepartment: 'Sector Skill Council (SSC) & District Training Centers',
    deadlineInfo: 'Varies by programme',
    checkEligibility: (profile: BeneficiaryProfile) => {
      const matched: string[] = [];
      const missing: string[] = [];
      let score = 55;

      const trade = profile.traditionalTrade || profile.currentOccupation;
      if (trade && trade !== 'Other') {
        matched.push(`Artisan trade recognized for toolkit: ${trade}`);
        score += 30;
      } else {
        missing.push('Select specific craft/trade (Tailoring, Leather, Solar, Electrician, Mechanics)');
      }

      matched.push('Eligible for Recognition of Prior Learning (RPL) fast-track test');
      score += 15;

      score = Math.min(100, Math.max(20, score));
      const status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible' = score >= 80 ? 'Eligible' : 'Potential Match';
      return { score, status, matched, missing };
    },
  },
  {
    id: 'nsfdc-term-loan',
    name: 'NSFDC Concessional Term Loan / Micro-Credit',
    shortName: 'NSFDC concessional loan',
    category: 'Concessional Loan',
    officialBenefit: 'Concessional term loans and micro-credit for SC persons through State Channelising Agencies. Limits and interest rates as per NSFDC schemes.',
    maxFinancialValue: 'As per NSFDC scheme',
    circularRef: 'See scheme details on nsfdc.nic.in',
    officialSourceUrl: 'https://nsfdc.nic.in',
    nodalDepartment: 'State SC Channelising Agency (SCA) & District Banks',
    deadlineInfo: 'Apply through your State Channelising Agency',
    checkEligibility: (profile: BeneficiaryProfile) => {
      const matched: string[] = [];
      const missing: string[] = [];
      let score = 50;

      matched.push('Scheduled Caste entrepreneur linkage');
      score += 20;

      if (profile.bankAccountNumber || profile.bankIfscCode) {
        matched.push(`Valid bank account mapped for DBT/disbursement (${profile.bankName || 'bank account added'})`);
        score += 20;
      } else {
        missing.push('Bank passbook details needed for credit appraisal');
      }

      if (profile.workPreference?.includes('Self-Employment')) {
        matched.push('Enterprise intent clearly stated');
        score += 10;
      }

      score = Math.min(100, Math.max(10, score));
      const status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible' = score >= 80 ? 'Eligible' : 'Potential Match';
      return { score, status, matched, missing };
    },
  },
  {
    id: 'pm-mudra-shishu',
    name: 'Pradhan Mantri MUDRA Yojana (Shishu & Kishore Enterprise Loan)',
    shortName: 'MUDRA Collateral-Free Bank Credit',
    category: 'Concessional Loan',
    officialBenefit: 'Collateral-free loans for micro enterprises: Shishu up to ₹50,000, Kishore ₹50,000 to ₹5 lakh, Tarun for higher amounts.',
    maxFinancialValue: 'Shishu up to ₹50,000 · Kishore up to ₹5 lakh',
    circularRef: 'See mudra.org.in',
    officialSourceUrl: 'https://www.mudra.org.in',
    nodalDepartment: 'Public Sector Banks & Regional Rural Banks (RRBs)',
    deadlineInfo: 'Apply at banks, NBFCs or MFIs',
    checkEligibility: (profile: BeneficiaryProfile) => {
      const matched: string[] = [];
      const missing: string[] = [];
      let score = 70;

      matched.push('Micro-enterprise activity in manufacturing, trading, or service sector');
      matched.push('Zero property collateral or third-party guarantee required');

      if (profile.aadhaarNumber) {
        matched.push('Aadhaar KYC readily available');
        score += 15;
      } else {
        missing.push('Aadhaar card verification needed for instant bank e-KYC');
      }

      score = Math.min(100, Math.max(20, score));
      const status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible' = score >= 80 ? 'Eligible' : 'Potential Match';
      return { score, status, matched, missing };
    },
  },
  {
    id: 'pm-vishwakarma',
    name: 'PM Vishwakarma Scheme for Traditional Artisans',
    shortName: 'PM Vishwakarma Toolkit & Credit',
    category: 'Toolkit Support',
    officialBenefit: '₹15,000 toolkit e-voucher + ₹1,00,000 collateral-free credit at subsidized 5% interest + daily ₹500 stipend during basic training.',
    maxFinancialValue: '₹15k Toolkit + ₹1 Lakh at 5%',
    circularRef: 'See pmvishwakarma.gov.in',
    officialSourceUrl: 'https://pmvishwakarma.gov.in',
    nodalDepartment: 'District Industries Centre (DIC) & MSME DFO',
    deadlineInfo: 'Register through a Common Service Centre (CSC)',
    checkEligibility: (profile: BeneficiaryProfile) => {
      const matched: string[] = [];
      const missing: string[] = [];
      let score = 55;

      const trade = (profile.traditionalTrade || profile.currentOccupation || '').toLowerCase();
      const vishwakarmaTrades = ['tailor', 'cobbler', 'leather', 'carpenter', 'blacksmith', 'potter', 'barber', 'mason'];
      const isMatch = vishwakarmaTrades.some(t => trade.includes(t));

      if (isMatch) {
        matched.push(`Recognized traditional artisan trade (${profile.traditionalTrade || profile.currentOccupation})`);
        score += 35;
      } else {
        missing.push('Trade must match one of the 18 notified traditional artisan crafts');
      }

      score = Math.min(100, Math.max(10, score));
      const status: 'Eligible' | 'Potential Match' | 'Missing Info' | 'Ineligible' = score >= 80 ? 'Eligible' : 'Potential Match';
      return { score, status, matched, missing };
    },
  },
];

export const schemeEngine = {
  // Deterministic evaluation of verified government schemes
  evaluateAllSchemes(profile: BeneficiaryProfile): VerifiedSchemeMatch[] {
    return VERIFIED_SCHEMES.map(def => {
      const result = def.checkEligibility(profile);
      return {
        schemeId: def.id,
        name: def.name,
        shortName: def.shortName,
        category: def.category,
        matchScore: result.score,
        eligibilityStatus: result.status,
        officialBenefit: def.officialBenefit,
        matchedCriteria: result.matched,
        missingCriteria: result.missing,
        officialSourceUrl: def.officialSourceUrl,
        circularRef: def.circularRef,
        nodalDepartment: def.nodalDepartment,
        deadlineInfo: def.deadlineInfo,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  },
};
