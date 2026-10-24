import type { CatalogScheme } from './schemeCatalog';
import { SCHEME_CATALOG } from './schemeCatalog';

/**
 * Loans: government loan schemes plus common bank, NBFC and microfinance loan products.
 * Figures are indicative public information gathered in October 2026. Interest rates change
 * with the RBI repo rate and each borrower's profile, so the UI always says the lender's own
 * quote is final and links to its official page.
 */

export type LoanCategory = 'business' | 'agriculture' | 'education' | 'housing' | 'women' | 'community' | 'micro' | 'quick';

export const LOAN_CATEGORIES: Array<{ id: LoanCategory; label: string; hint: string }> = [
  { id: 'business', label: 'Business & self-employment', hint: 'Start or grow a shop, unit or trade' },
  { id: 'agriculture', label: 'Farming, dairy & fisheries', hint: 'Crops, animals, fishing, farm equipment' },
  { id: 'education', label: 'Education', hint: 'College, school or skill course fees' },
  { id: 'housing', label: 'Home', hint: 'Buy, build or repair a house' },
  { id: 'women', label: 'Women & self-help groups', hint: 'SHG and women-led businesses' },
  { id: 'community', label: 'SC / ST / OBC / minorities', hint: 'Low-interest loans from national corporations' },
  { id: 'micro', label: 'Street vendors & small loans', hint: 'Small amounts without collateral' },
  { id: 'quick', label: 'Gold & personal loans', hint: 'Quick money for urgent needs' },
];

export type LenderType = 'government' | 'public-bank' | 'private-bank' | 'nbfc' | 'mfi' | 'cooperative';

export const LENDER_TYPE_LABEL: Record<LenderType, string> = {
  government: 'Government channel',
  'public-bank': 'Public sector bank',
  'private-bank': 'Private bank',
  nbfc: 'NBFC',
  mfi: 'Microfinance',
  cooperative: 'Co-operative / RRB',
};

/** One place a person can take this loan from, with what it costs there. */
export interface LenderOffer {
  /** Short name, also used as the "lender" answer on the form. */
  lender: string;
  type: LenderType;
  /** Indicative interest, in words. */
  rate: string;
  /** Lowest indicative yearly rate (%), used only for EMI estimates. */
  rateFrom?: number;
  note?: string;
  url: string;
}

export interface LoanDetails {
  category: LoanCategory;
  /** 'government' = a government scheme or corporation; 'market' = a lender's own product. */
  backing: 'government' | 'market';
  amount: { min?: number; max?: number; text: string };
  /** Headline interest, in words. */
  rate: string;
  /** Yearly rate (%) used for EMI estimates when the person's lender gives no figure. */
  estimateRate: number;
  tenure: string;
  /** A typical repayment period in months, the default for EMI estimates. */
  tenureMonths: number;
  collateral: string;
  /** Government subsidy or interest help, if any. */
  subsidy?: string;
  /** Anything that changes whether the loan is open now. */
  statusNote?: string;
  offers: LenderOffer[];
  checked: string;
}

/** A loan product with its own form. Same shape as a scheme, so search, eligibility and cards reuse it. */
export interface LoanProduct extends CatalogScheme, LoanDetails {
  kind: 'loan';
}

const CHECKED = 'October 2026';

const ANY_BANK: LenderOffer[] = [
  { lender: 'SBI', type: 'public-bank', rate: 'Bank rate for the scheme', url: 'https://sbi.co.in' },
  { lender: 'Bank of Baroda', type: 'public-bank', rate: 'Bank rate for the scheme', url: 'https://www.bankofbaroda.in' },
  { lender: 'Punjab National Bank', type: 'public-bank', rate: 'Bank rate for the scheme', url: 'https://www.pnbindia.in' },
  { lender: 'Canara Bank', type: 'public-bank', rate: 'Bank rate for the scheme', url: 'https://canarabank.com' },
  { lender: 'Regional Rural / co-operative bank', type: 'cooperative', rate: 'Bank rate for the scheme', url: 'https://www.nabard.org' },
];

/** Loan facts for schemes that already live in the scheme catalog (they keep their forms there). */
const SCHEME_LOAN_DETAILS: Record<string, LoanDetails> = {
  mudra: {
    category: 'business',
    backing: 'government',
    amount: { max: 2000000, text: 'Shishu up to ₹50,000 · Kishore ₹50,000–5 lakh · Tarun ₹5–10 lakh · Tarun Plus ₹10–20 lakh (only after repaying a Tarun loan)' },
    rate: 'Set by each lender — there is no fixed MUDRA rate',
    estimateRate: 10,
    tenure: 'Usually 3 to 5 years',
    tenureMonths: 36,
    collateral: 'No collateral — loans are guaranteed under CGFMU',
    offers: [
      ...ANY_BANK.slice(0, 4),
      { lender: 'Small finance bank / NBFC / MFI', type: 'nbfc', rate: 'Usually higher than public banks', url: 'https://www.mudra.org.in' },
      { lender: 'JanSamarth portal (online)', type: 'government', rate: 'Pick a bank online', url: 'https://www.jansamarth.in' },
    ],
    checked: CHECKED,
  },
  nsfdc: {
    category: 'community',
    backing: 'government',
    amount: { max: 5000000, text: 'Term loans for projects up to ₹50 lakh — up to 90% of the project cost' },
    rate: 'Concessional — about 8% a year or less for the borrower',
    estimateRate: 8,
    tenure: 'Up to about 7 years',
    tenureMonths: 60,
    collateral: 'As decided by the State Channelising Agency',
    offers: [{ lender: 'State SC Development Corporation', type: 'government', rate: 'Concessional, about 8% or less', rateFrom: 6, url: 'https://nsfdc.nic.in' }],
    checked: CHECKED,
  },
  'stand-up-india': {
    category: 'women',
    backing: 'government',
    amount: { min: 1000000, max: 10000000, text: '₹10 lakh to ₹1 crore for a new (greenfield) enterprise' },
    rate: "Capped at the bank's lowest rate for the category plus a small margin",
    estimateRate: 10,
    tenure: 'Up to 7 years, with up to 18 months before repayments start',
    tenureMonths: 84,
    collateral: 'Collateral or the Credit Guarantee Fund for Stand-Up India (CGFSIL), as the bank decides',
    statusNote:
      'The original scheme stopped taking new loans on 31 March 2025. A revamped scheme for SC/ST and women entrepreneurs was announced in 2026 — confirm current terms at your bank or standupmitra.in before applying.',
    offers: [...ANY_BANK.slice(0, 4), { lender: 'Stand-Up Mitra portal (online)', type: 'government', rate: 'Connects you to a bank', url: 'https://www.standupmitra.in' }],
    checked: CHECKED,
  },
  'pm-vishwakarma': {
    category: 'business',
    backing: 'government',
    amount: { max: 300000, text: '₹1 lakh first (repaid in 18 months), then ₹2 lakh (repaid in 30 months)' },
    rate: '5% a year — the government pays the rest of the interest (up to 8%)',
    estimateRate: 5,
    tenure: '18 months, then 30 months',
    tenureMonths: 18,
    collateral: 'No collateral',
    subsidy: 'Interest help up to 8% a year, plus toolkit support and ₹1 per digital transaction (up to 100 a month)',
    offers: [...ANY_BANK.slice(0, 4).map((o) => ({ ...o, rate: '5% a year', rateFrom: 5 })), { lender: 'Common Service Centre (registration)', type: 'government', rate: 'Register first at a CSC', url: 'https://pmvishwakarma.gov.in' }],
    checked: CHECKED,
  },
};

export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'loan-pmegp',
    kind: 'loan',
    name: 'PMEGP loan with subsidy (Prime Minister’s Employment Generation Programme)',
    ministry: 'Ministry of MSME, through KVIC',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'A bank loan to set up a new manufacturing or service unit, with a government subsidy of 15% to 35% of the project cost.',
    keySupport: ['Projects up to ₹50 lakh (manufacturing) or ₹20 lakh (service / business)', 'Subsidy 25% (urban) / 35% (rural) for SC, ST, OBC, minorities, women, ex-servicemen, PwD and NE/hill areas; 15% / 25% for others'],
    eligibilitySummary: 'Anyone 18+ starting a NEW unit. Projects above ₹10 lakh (manufacturing) or ₹5 lakh (service) need at least 8th pass.',
    documents: ['Aadhaar card', 'PAN card', 'Project report', 'Caste / special-category certificate (if claiming higher subsidy)', 'Education certificate', 'Bank passbook', 'Photo'],
    steps: ['Apply on the KVIC PMEGP e-portal and choose a bank', 'District task force interview', 'Bank appraises and sanctions the loan', 'Complete the EDP training, then the subsidy is released'],
    officialUrl: 'https://www.kviconline.gov.in/pmegpeportal/',
    officialLabel: 'kviconline.gov.in',
    roadmapPriority: 4,
    rules: { minAge: 18 },
    category: 'business',
    backing: 'government',
    amount: { max: 5000000, text: 'Project cost up to ₹50 lakh (manufacturing) or ₹20 lakh (service); you put in 5–10%' },
    rate: 'Normal bank MSME rate',
    estimateRate: 10,
    tenure: '3 to 7 years after an initial moratorium',
    tenureMonths: 60,
    collateral: 'None for projects up to ₹10 lakh; larger loans are covered by the CGTMSE guarantee',
    subsidy: '15% to 35% of the project cost (margin money), kept for 3 years then adjusted against the loan',
    offers: ANY_BANK,
    checked: CHECKED,
  },
  {
    id: 'loan-cgtmse',
    kind: 'loan',
    name: 'Collateral-free MSME loan (CGTMSE guarantee)',
    ministry: 'Credit Guarantee Fund Trust for Micro and Small Enterprises (Ministry of MSME & SIDBI)',
    filters: ['entrepreneurship'],
    summary: 'Banks and NBFCs lend to micro and small enterprises without collateral because the trust guarantees most of the loan.',
    keySupport: ['Loans up to ₹10 crore without collateral or third-party guarantee', 'Guarantee covers up to 90% for women-led and micro units, 75% for most others'],
    eligibilitySummary: 'New or existing micro and small manufacturing, service or trading enterprises, usually with Udyam registration.',
    documents: ['Udyam registration', 'PAN card', 'Aadhaar card', 'Business plan or financial statements', 'Bank statements (last 6–12 months)'],
    steps: ['Get Udyam registration (free)', 'Apply for a business loan at a member bank or NBFC', 'The lender appraises the business', 'The lender takes CGTMSE cover and sanctions the loan'],
    officialUrl: 'https://www.cgtmse.in',
    officialLabel: 'cgtmse.in',
    roadmapPriority: 2,
    rules: { minAge: 18 },
    category: 'business',
    backing: 'government',
    amount: { max: 100000000, text: 'Up to ₹10 crore per borrower' },
    rate: 'Lender’s MSME rate, plus a yearly guarantee fee of about 0.37% to 1.2%',
    estimateRate: 10.5,
    tenure: 'As agreed with the lender (often up to 5–7 years)',
    tenureMonths: 60,
    collateral: 'No collateral — the CGTMSE guarantee replaces it',
    offers: [...ANY_BANK.slice(0, 4), { lender: 'HDFC Bank', type: 'private-bank', rate: 'Bank MSME rate', url: 'https://www.hdfcbank.com' }, { lender: 'ICICI Bank', type: 'private-bank', rate: 'Bank MSME rate', url: 'https://www.icicibank.com' }],
    checked: CHECKED,
  },
  {
    id: 'loan-business',
    kind: 'loan',
    name: 'Business loan from a bank or NBFC',
    ministry: 'Banks and RBI-registered NBFCs',
    filters: ['entrepreneurship'],
    summary: 'A regular business loan for working capital, stock or machines. Banks are cheaper; NBFCs are faster and need less paperwork.',
    keySupport: ['Banks: lowest rates, more documents', 'NBFCs: ₹2 lakh to ₹80 lakh, quick approval, higher interest'],
    eligibilitySummary: 'Businesses usually running for 1–3 years with income proof, bank statements and a fair credit score.',
    documents: ['PAN card', 'Aadhaar card', 'Udyam / GST / shop registration', 'Bank statements (last 6–12 months)', 'Income tax return (if filed)'],
    steps: ['Compare the rate, processing fee and total cost', 'Apply at the branch or the lender’s app', 'Submit KYC and business documents', 'Sign the loan agreement after reading the Key Fact Statement'],
    officialUrl: 'https://sachet.rbi.org.in',
    officialLabel: 'Check the lender is RBI-registered (sachet.rbi.org.in)',
    roadmapPriority: 1,
    rules: { minAge: 21 },
    category: 'business',
    backing: 'market',
    amount: { min: 200000, max: 8000000, text: 'About ₹2 lakh to ₹80 lakh (NBFC); banks lend by business size' },
    rate: 'About 10–12% at banks; about 14–23.5% at NBFCs',
    estimateRate: 14,
    tenure: '1 to 8 years',
    tenureMonths: 36,
    collateral: 'Often none for smaller loans; property or machinery for larger ones',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'Linked to SBI’s lending rate (about 10%+)', rateFrom: 10, url: 'https://sbi.co.in/web/business/sme' },
      { lender: 'HDFC Bank', type: 'private-bank', rate: 'Depends on profile', url: 'https://www.hdfcbank.com' },
      { lender: 'Bajaj Finance', type: 'nbfc', rate: 'About 14% to 23.5% a year', rateFrom: 14, note: 'Processing fee up to about 3.5–4.7% of the loan', url: 'https://www.bajajfinserv.in/business-loan' },
      { lender: 'Other online NBFC', type: 'nbfc', rate: 'Usually higher — ask for the APR', url: 'https://sachet.rbi.org.in' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-svanidhi',
    kind: 'loan',
    name: 'PM SVANidhi — loans for street vendors',
    ministry: 'Ministry of Housing and Urban Affairs & Department of Financial Services',
    filters: ['livelihood', 'entrepreneurship'],
    summary: 'Small working-capital loans for street vendors without collateral. Repaying on time unlocks the next, bigger loan.',
    keySupport: ['₹15,000 first, then ₹25,000, then ₹50,000', '7% interest subsidy and up to ₹1,600 digital cashback', 'UPI-linked RuPay credit card after repaying the second loan'],
    eligibilitySummary: 'Street vendors with a vending certificate / ID from the urban local body, or a letter of recommendation. Open until 31 March 2030.',
    documents: ['Aadhaar card (linked to mobile)', 'Vending certificate, vendor ID card or letter of recommendation', 'Bank passbook'],
    steps: ['Apply on the PM SVANidhi portal or at a CSC / bank', 'The urban local body verifies you', 'The bank sanctions the loan', 'Repay monthly to unlock the next loan'],
    officialUrl: 'https://pmsvanidhi.mohua.gov.in',
    officialLabel: 'pmsvanidhi.mohua.gov.in',
    roadmapPriority: 3,
    rules: { minAge: 18 },
    category: 'micro',
    backing: 'government',
    amount: { min: 15000, max: 50000, text: '₹15,000 → ₹25,000 → ₹50,000' },
    rate: 'Bank rate, with a 7% interest subsidy credited back',
    estimateRate: 5,
    tenure: 'About 12 months for the first loan; longer for later ones',
    tenureMonths: 12,
    collateral: 'No collateral',
    subsidy: '7% interest subsidy, up to ₹1,600 cashback on digital transactions',
    offers: ANY_BANK.slice(0, 4).concat({ lender: 'Common Service Centre (help to apply)', type: 'government', rate: 'Apply with help', url: 'https://pmsvanidhi.mohua.gov.in' }),
    checked: CHECKED,
  },
  {
    id: 'loan-microfinance',
    kind: 'loan',
    name: 'Microfinance loan (MFI / small finance bank)',
    ministry: 'RBI-regulated microfinance institutions and small finance banks',
    filters: ['livelihood'],
    summary: 'Small collateral-free loans, often to women in groups, for households earning up to ₹3 lakh a year.',
    keySupport: ['No collateral', 'All loan repayments together cannot exceed 50% of monthly household income (RBI rule)'],
    eligibilitySummary: 'Households with yearly income up to ₹3 lakh. Often given through joint-liability groups of women.',
    documents: ['Aadhaar card', 'Voter ID or other KYC', 'Bank passbook', 'Household income declaration'],
    steps: ['Join or form a group with the MFI field officer', 'Group training and household check', 'Loan sanction', 'Repay weekly / monthly at group meetings'],
    officialUrl: 'https://sachet.rbi.org.in',
    officialLabel: 'Check the lender is RBI-registered (sachet.rbi.org.in)',
    roadmapPriority: 1,
    rules: { minAge: 18, maxAnnualIncome: 300000 },
    category: 'micro',
    backing: 'market',
    amount: { min: 10000, max: 200000, text: 'Usually ₹10,000 to ₹2 lakh' },
    rate: 'Set by the lender — usually higher than bank loans; ask for the APR',
    estimateRate: 22,
    tenure: '1 to 2 years',
    tenureMonths: 24,
    collateral: 'No collateral',
    offers: [
      { lender: 'Bandhan Bank', type: 'private-bank', rate: 'Ask for the APR', url: 'https://bandhan.bank.in' },
      { lender: 'Ujjivan Small Finance Bank', type: 'private-bank', rate: 'Ask for the APR', url: 'https://www.ujjivansfb.in' },
      { lender: 'Other RBI-registered MFI', type: 'mfi', rate: 'Ask for the APR', url: 'https://sachet.rbi.org.in' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-shg',
    kind: 'loan',
    name: 'Self-help group (SHG) bank loan — DAY-NRLM / DAY-NULM',
    ministry: 'Ministry of Rural Development / Ministry of Housing and Urban Affairs',
    filters: ['livelihood', 'entrepreneurship'],
    summary: 'Bank credit for a whole self-help group, without collateral, at a low rate for women’s groups.',
    keySupport: ['Up to ₹20 lakh with no collateral and no margin', 'Women’s SHGs: 7% interest on loans up to ₹3 lakh, less with prompt repayment in eligible districts'],
    eligibilitySummary: 'SHGs (mostly women) that save regularly, keep books and have been graded by the bank or mission.',
    documents: ['SHG resolution to borrow', 'SHG savings passbook', 'Aadhaar of office-bearers', 'Meeting and book records'],
    steps: ['Group is graded by the bank / livelihood mission', 'Pass a resolution and fill the bank form', 'Bank sanctions a cash-credit or term loan', 'Repay from group savings and members’ income'],
    officialUrl: 'https://aajeevika.gov.in',
    officialLabel: 'aajeevika.gov.in',
    roadmapPriority: 3,
    rules: { minAge: 18 },
    category: 'women',
    backing: 'government',
    amount: { max: 2000000, text: 'Up to ₹20 lakh per group, in stages' },
    rate: '7% for women’s SHGs up to ₹3 lakh; bank rate above that',
    estimateRate: 7,
    tenure: 'Cash credit renewed yearly; term loans 3–5 years',
    tenureMonths: 36,
    collateral: 'No collateral and no lien on savings up to ₹20 lakh',
    subsidy: 'Interest subvention to 7%, plus an extra 3% for prompt repayment in eligible districts',
    offers: ANY_BANK,
    checked: CHECKED,
  },
  {
    id: 'loan-kcc',
    kind: 'loan',
    name: 'Kisan Credit Card (crops, dairy, poultry & fisheries)',
    ministry: 'Department of Agriculture & Farmers Welfare, through banks',
    filters: ['livelihood'],
    summary: 'A revolving credit limit for farmers, animal keepers and fishers to buy seed, feed, fertiliser and meet farm expenses.',
    keySupport: ['7% interest on short-term loans up to ₹3 lakh; effectively 4% if repaid on time', 'Budget 2025-26 raised the interest-help limit to ₹5 lakh — confirm with your bank', 'No collateral up to ₹2 lakh'],
    eligibilitySummary: 'Farmers (owners, tenants, sharecroppers), SHGs / JLGs of farmers, and people in animal husbandry or fisheries.',
    documents: ['Aadhaar card', 'Land record / lease or cultivation proof', 'Bank passbook', 'Photo', 'For dairy / fisheries: proof of animals, pond or boat'],
    steps: ['Fill the KCC form (one page) at your bank, or via the PM-Kisan site', 'Bank checks land / activity records', 'Credit limit is set from the crop and land area', 'Use the RuPay KCC card; repay each crop season'],
    officialUrl: 'https://pmkisan.gov.in',
    officialLabel: 'pmkisan.gov.in (KCC form)',
    roadmapPriority: 4,
    rules: { minAge: 18 },
    category: 'agriculture',
    backing: 'government',
    amount: { max: 500000, text: 'Limit set by crop, land and activity; interest help on up to ₹3–5 lakh' },
    rate: '7% a year, about 4% with prompt repayment',
    estimateRate: 7,
    tenure: 'Limit valid 5 years; repay each season (about 12 months)',
    tenureMonths: 12,
    collateral: 'None up to ₹2 lakh',
    subsidy: '1.5% interest help to banks plus 3% prompt-repayment incentive for you',
    offers: ANY_BANK.map((o) => ({ ...o, rate: '7%, about 4% if repaid on time', rateFrom: 4 })),
    checked: CHECKED,
  },
  {
    id: 'loan-ahidf',
    kind: 'loan',
    name: 'Animal Husbandry Infrastructure Development Fund (AHIDF)',
    ministry: 'Department of Animal Husbandry & Dairying',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'Bank loans with 3% interest help for dairy processing, meat processing, animal-feed plants and breed farms.',
    keySupport: ['3% interest subvention on the loan', 'Credit guarantee support for MSMEs'],
    eligibilitySummary: 'Individual entrepreneurs, MSMEs, farmer producer organisations, private companies and Section 8 companies.',
    documents: ['Detailed project report', 'PAN and Aadhaar', 'Udyam registration (if any)', 'Land or lease documents', 'Bank statements'],
    steps: ['Prepare a project report', 'Apply on the AHIDF portal and choose a bank', 'Bank appraisal and sanction', 'Interest help is credited during repayment'],
    officialUrl: 'https://ahidf.udyamimitra.in',
    officialLabel: 'ahidf.udyamimitra.in',
    roadmapPriority: 1,
    rules: { minAge: 18 },
    category: 'agriculture',
    backing: 'government',
    amount: { text: 'Up to 90% of the project cost (you put in at least 10%)' },
    rate: 'Bank rate minus 3% interest subvention',
    estimateRate: 7,
    tenure: 'Up to 8 years plus a 2-year moratorium',
    tenureMonths: 96,
    collateral: 'As decided by the bank; credit guarantee available',
    subsidy: '3% interest subvention',
    offers: ANY_BANK.slice(0, 4),
    checked: CHECKED,
  },
  {
    id: 'loan-vidyalaxmi',
    kind: 'loan',
    name: 'PM-Vidyalaxmi education loan (top institutions)',
    ministry: 'Ministry of Education',
    filters: ['education'],
    summary: 'Education loans without collateral or guarantor for students admitted on merit to about 860 top-ranked institutions.',
    keySupport: ['Covers full tuition and course costs', '3% interest help on up to ₹10 lakh for family income up to ₹8 lakh', 'Government guarantees 75% of loans up to ₹7.5 lakh'],
    eligibilitySummary: 'Students admitted on merit (not management quota) to a listed Quality Higher Education Institution.',
    documents: ['Admission letter', 'Fee structure', 'Marksheets', 'Aadhaar and PAN (student and parent)', 'Income certificate (for interest help)'],
    steps: ['Register on the PM-Vidyalaxmi portal', 'Fill the common education loan form and choose up to 3 banks', 'Upload documents', 'Track the bank’s decision on the portal'],
    officialUrl: 'https://www.pmvidyalaxmi.co.in',
    officialLabel: 'pmvidyalaxmi.co.in',
    roadmapPriority: 3,
    rules: { minAge: 16 },
    category: 'education',
    backing: 'government',
    amount: { text: 'Full course cost; interest help on up to ₹10 lakh' },
    rate: 'Set by the bank (about 8% for top institutions at SBI)',
    estimateRate: 8.5,
    tenure: 'Up to 15 years after the course and moratorium',
    tenureMonths: 120,
    collateral: 'No collateral and no guarantor',
    subsidy: '3% interest help (family income up to ₹8 lakh); full interest help in the moratorium for income up to ₹4.5 lakh (PM-USP)',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'About 7.7–8.2% for top institutions', rateFrom: 7.7, url: 'https://sbi.co.in/web/personal-banking/loans/education-loans' },
      { lender: 'Bank of Baroda', type: 'public-bank', rate: 'Bank rate for the institute', url: 'https://www.bankofbaroda.in' },
      { lender: 'Canara Bank', type: 'public-bank', rate: 'Bank rate for the institute', url: 'https://canarabank.com' },
      { lender: 'Punjab National Bank', type: 'public-bank', rate: 'Bank rate for the institute', url: 'https://www.pnbindia.in' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-education',
    kind: 'loan',
    name: 'Education loan from a bank or NBFC (any course, school or abroad)',
    ministry: 'Banks and education NBFCs',
    filters: ['education'],
    summary: 'Loans for recognised courses in India or abroad, and for school fees. Parents usually join as co-borrowers.',
    keySupport: ['Usually no collateral up to ₹4–7.5 lakh', 'Repayment starts after the course plus a grace period', 'Girl students often get a lower rate'],
    eligibilitySummary: 'Indian students with admission to a recognised course; a parent or guardian as co-borrower.',
    documents: ['Admission letter and fee structure', 'Marksheets', 'KYC of student and co-borrower', 'Income proof of co-borrower'],
    steps: ['Compare banks on rate and margin money', 'Apply at the branch or on PM-Vidyalaxmi / JanSamarth', 'Submit admission and income documents', 'Fees are paid directly to the institute'],
    officialUrl: 'https://www.jansamarth.in',
    officialLabel: 'jansamarth.in',
    roadmapPriority: 2,
    rules: { minAge: 16 },
    category: 'education',
    backing: 'market',
    amount: { text: 'Up to the full cost; ₹4 lakh for school (Baroda Vidya); much more for abroad' },
    rate: 'About 8–11% at public banks; higher at NBFCs',
    estimateRate: 10,
    tenure: 'Up to 15 years after the course',
    tenureMonths: 84,
    collateral: 'None up to about ₹4–7.5 lakh; security above that',
    subsidy: 'Interest during the course is paid by the government for family income up to ₹4.5 lakh (CSIS / PM-USP)',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'About 8–10% (Student / Scholar loans)', rateFrom: 8, url: 'https://sbi.co.in/web/personal-banking/loans/education-loans' },
      { lender: 'Bank of Baroda', type: 'public-bank', rate: 'Baroda Vidya (school): about 11.25%; 0.5% less for girls', rateFrom: 11.25, url: 'https://www.bankofbaroda.in/personal-banking/loans/education-loan/baroda-vidya' },
      { lender: 'HDFC Credila', type: 'nbfc', rate: 'Higher than public banks — compare the quote', url: 'https://www.credila.com' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-pmay-home',
    kind: 'loan',
    name: 'Home loan with PMAY-Urban 2.0 interest subsidy',
    ministry: 'Ministry of Housing and Urban Affairs',
    filters: ['livelihood'],
    summary: 'A normal home loan from a bank or housing finance company, with up to ₹1.80 lakh of interest paid back by the government.',
    keySupport: ['4% interest subsidy on the first ₹8 lakh of the loan (12-year tenure)', 'Up to ₹1.80 lakh, paid in 5 yearly instalments', 'For loans up to ₹25 lakh on homes worth up to ₹35 lakh'],
    eligibilitySummary: 'Urban families earning up to ₹9 lakh a year (EWS up to ₹3 lakh, LIG ₹3–6 lakh, MIG ₹6–9 lakh) with no pucca house anywhere in India.',
    documents: ['Aadhaar of all family members', 'Income proof / certificate', 'Property papers or sale agreement', 'Self-declaration of no pucca house', 'Bank statements'],
    steps: ['Apply for PMAY-U 2.0 (ISS) on the official portal', 'Take a home loan from a listed bank or HFC', 'Lender submits the subsidy claim', 'Subsidy is credited to the loan account yearly'],
    officialUrl: 'https://pmay-urban.gov.in',
    officialLabel: 'pmay-urban.gov.in',
    roadmapPriority: 2,
    rules: { minAge: 18, maxAnnualIncome: 900000 },
    category: 'housing',
    backing: 'government',
    amount: { max: 2500000, text: 'Loan up to ₹25 lakh, home value up to ₹35 lakh, up to 120 sq m' },
    rate: 'Lender’s home-loan rate (about 7.15–8.5%), minus the subsidy',
    estimateRate: 7.5,
    tenure: 'Up to 20–30 years',
    tenureMonths: 240,
    collateral: 'The house is mortgaged',
    subsidy: 'Up to ₹1.80 lakh interest subsidy (loans sanctioned from 1 September 2024)',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'About 7.25–8.45%', rateFrom: 7.25, url: 'https://homeloans.sbi' },
      { lender: 'LIC Housing Finance', type: 'nbfc', rate: 'About 7.15–8.2%', rateFrom: 7.15, url: 'https://www.lichousing.com' },
      { lender: 'HDFC Bank', type: 'private-bank', rate: 'From about 7.45%', rateFrom: 7.45, url: 'https://www.hdfcbank.com' },
      { lender: 'Bank of Baroda', type: 'public-bank', rate: 'Linked to BRLLR', url: 'https://www.bankofbaroda.in' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-home',
    kind: 'loan',
    name: 'Home loan (buy, build or repair)',
    ministry: 'Banks and housing finance companies',
    filters: ['livelihood'],
    summary: 'Long-term loans to buy, build, extend or repair a house. Rates are lowest for people with a good credit score.',
    keySupport: ['Rates from about 7.15% a year', 'Up to 75–90% of the property value', 'Tax benefits on interest and principal'],
    eligibilitySummary: 'Salaried or self-employed people with steady income; the property must have clear papers.',
    documents: ['KYC (Aadhaar, PAN)', 'Income proof (salary slips or ITR)', 'Bank statements', 'Property documents'],
    steps: ['Compare rate and processing fee', 'Get in-principle sanction', 'Property legal and technical check', 'Sign the agreement; loan is paid to the seller / builder'],
    officialUrl: 'https://sachet.rbi.org.in',
    officialLabel: 'Check the lender is RBI / NHB-registered',
    roadmapPriority: 1,
    rules: { minAge: 21 },
    category: 'housing',
    backing: 'market',
    amount: { text: 'Up to 75–90% of the property value' },
    rate: 'About 7.15% to 8.5% for good credit scores; higher otherwise',
    estimateRate: 8,
    tenure: 'Up to 30 years',
    tenureMonths: 240,
    collateral: 'The house is mortgaged',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'About 7.25–8.45%', rateFrom: 7.25, note: 'Fee about 0.35% (₹3,000–12,000 + GST)', url: 'https://homeloans.sbi' },
      { lender: 'LIC Housing Finance', type: 'nbfc', rate: 'About 7.15–8.2%', rateFrom: 7.15, url: 'https://www.lichousing.com' },
      { lender: 'HDFC Bank', type: 'private-bank', rate: 'About 7.45% upward', rateFrom: 7.45, url: 'https://www.hdfcbank.com' },
      { lender: 'Affordable housing finance company', type: 'nbfc', rate: 'Higher — for informal income', url: 'https://nhb.org.in' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-nbcfdc',
    kind: 'loan',
    name: 'NBCFDC term loan (Backward Classes)',
    ministry: 'Ministry of Social Justice & Empowerment',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'Low-interest loans for OBC persons to start income-generating activities, through State Channelising Agencies.',
    keySupport: ['Loans up to ₹15 lakh', 'About 6% (up to ₹5 lakh), 7% (₹5–10 lakh), 8% (₹10–15 lakh)'],
    eligibilitySummary: 'Backward Class persons within the family income limit set by NBCFDC.',
    documents: ['OBC certificate', 'Income certificate', 'Aadhaar card', 'Project report', 'Bank passbook'],
    steps: ['Contact your State Backward Classes Finance Corporation', 'Submit the application and project report', 'Appraisal and sanction', 'Disbursement'],
    officialUrl: 'https://nbcfdc.gov.in',
    officialLabel: 'nbcfdc.gov.in',
    roadmapPriority: 3,
    rules: { minAge: 18 },
    category: 'community',
    backing: 'government',
    amount: { max: 1500000, text: 'Up to ₹15 lakh (NBCFDC funds up to 85%)' },
    rate: 'About 6–8% a year by loan size',
    estimateRate: 6,
    tenure: 'Up to about 8 years',
    tenureMonths: 60,
    collateral: 'As required by the State agency',
    offers: [{ lender: 'State Backward Classes Finance Corporation', type: 'government', rate: 'About 6–8%', rateFrom: 6, url: 'https://nbcfdc.gov.in' }],
    checked: CHECKED,
  },
  {
    id: 'loan-nskfdc',
    kind: 'loan',
    name: 'NSKFDC loan (Safai Karamcharis and manual scavengers)',
    ministry: 'Ministry of Social Justice & Empowerment',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'Low-interest loans for sanitation workers, manual scavengers and their dependents to start a new livelihood.',
    keySupport: ['Up to ₹15 lakh at 6% a year', 'Up to 90% of the unit cost', 'Repay over up to 10 years after a moratorium'],
    eligibilitySummary: 'Safai karamcharis, manual scavengers, waste pickers and their dependents.',
    documents: ['Certificate as safai karamchari / manual scavenger (or dependent)', 'Aadhaar card', 'Project details', 'Bank passbook'],
    steps: ['Contact the State Channelising Agency', 'Submit the application', 'Appraisal and sanction', 'Disbursement'],
    officialUrl: 'https://nskfdc.nic.in',
    officialLabel: 'nskfdc.nic.in',
    roadmapPriority: 3,
    rules: { minAge: 18 },
    category: 'community',
    backing: 'government',
    amount: { max: 1500000, text: 'Up to ₹15 lakh' },
    rate: '6% a year',
    estimateRate: 6,
    tenure: 'Up to 10 years',
    tenureMonths: 60,
    collateral: 'As required by the State agency',
    offers: [{ lender: 'State Channelising Agency (NSKFDC)', type: 'government', rate: '6%', rateFrom: 6, url: 'https://nskfdc.nic.in' }],
    checked: CHECKED,
  },
  {
    id: 'loan-nmdfc',
    kind: 'loan',
    name: 'NMDFC term loan (Minorities)',
    ministry: 'Ministry of Minority Affairs',
    filters: ['entrepreneurship', 'livelihood'],
    summary: 'Low-interest business loans for Muslims, Christians, Sikhs, Buddhists, Jains and Parsis, through State agencies.',
    keySupport: ['Credit Line 1: up to ₹20 lakh at 6%', 'Credit Line 2: up to ₹30 lakh for family income up to ₹6 lakh'],
    eligibilitySummary: 'Notified minority community members within the NMDFC family income limits.',
    documents: ['Minority community declaration / certificate', 'Income certificate', 'Aadhaar card', 'Project report', 'Bank passbook'],
    steps: ['Contact the State Minorities Finance Corporation', 'Submit the application and project report', 'Appraisal and sanction', 'Disbursement'],
    officialUrl: 'https://nmdfc.org',
    officialLabel: 'nmdfc.org',
    roadmapPriority: 3,
    rules: { minAge: 18 },
    category: 'community',
    backing: 'government',
    amount: { max: 3000000, text: 'Up to ₹20 lakh (Credit Line 1) or ₹30 lakh (Credit Line 2)' },
    rate: 'About 6% a year (Credit Line 1)',
    estimateRate: 6,
    tenure: 'About 5 years after a 6-month moratorium',
    tenureMonths: 60,
    collateral: 'As required by the State agency',
    offers: [{ lender: 'State Minorities Finance Corporation', type: 'government', rate: 'About 6%', rateFrom: 6, url: 'https://nmdfc.org' }],
    checked: CHECKED,
  },
  {
    id: 'loan-gold',
    kind: 'loan',
    name: 'Gold loan',
    ministry: 'Banks and gold-loan NBFCs',
    filters: ['livelihood'],
    summary: 'Quick money against gold jewellery, often the same day. Banks are cheapest; NBFCs are faster with more branches.',
    keySupport: ['Up to 85% of the gold value for loans up to ₹2.5 lakh (RBI rules)', 'Little paperwork; no income proof for small loans'],
    eligibilitySummary: 'Anyone 18+ who owns gold jewellery (18–22 carat).',
    documents: ['Aadhaar card', 'PAN (for larger loans)', 'Photo', 'The gold jewellery'],
    steps: ['Take the jewellery to the branch', 'Gold is weighed and valued', 'Choose the scheme (monthly interest or EMI)', 'Get the money; repay to take the gold back'],
    officialUrl: 'https://sachet.rbi.org.in',
    officialLabel: 'Check the lender is RBI-registered',
    roadmapPriority: 1,
    rules: { minAge: 18 },
    category: 'quick',
    backing: 'market',
    amount: { min: 1500, text: 'From a few thousand rupees; up to 75–85% of the gold value' },
    rate: 'About 9–10% at banks; about 9–24% at NBFCs',
    estimateRate: 10,
    tenure: 'Usually 6 to 12 months; EMI options up to 3 years',
    tenureMonths: 12,
    collateral: 'Your gold jewellery',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'About 9.15–10.1%', rateFrom: 9.15, note: 'Minimum loan ₹20,000', url: 'https://sbi.co.in/web/personal-banking/loans/gold-loan' },
      { lender: 'Muthoot Finance', type: 'nbfc', rate: 'About 9% to 24% by scheme', rateFrom: 9, url: 'https://www.muthootfinance.com' },
      { lender: 'Manappuram Finance', type: 'nbfc', rate: 'About 9.9% to 24% by scheme', rateFrom: 9.9, url: 'https://www.manappuram.com' },
      { lender: 'Regional Rural / co-operative bank', type: 'cooperative', rate: 'About 9–12%', url: 'https://www.nabard.org' },
    ],
    checked: CHECKED,
  },
  {
    id: 'loan-personal',
    kind: 'loan',
    name: 'Personal loan',
    ministry: 'Banks and RBI-registered NBFCs',
    filters: ['livelihood'],
    summary: 'An unsecured loan for any need — medical, wedding, repairs. Costs more than secured loans; only borrow what you can repay.',
    keySupport: ['No collateral', 'Banks from about 10% a year for good credit scores', 'Always read the Key Fact Statement for the total cost'],
    eligibilitySummary: 'Salaried or self-employed people with regular income and a fair credit score.',
    documents: ['Aadhaar and PAN', 'Salary slips or income proof', 'Bank statements (last 3–6 months)'],
    steps: ['Check your credit score', 'Compare rate and processing fee', 'Apply at the bank or its app', 'Read the Key Fact Statement before signing'],
    officialUrl: 'https://sachet.rbi.org.in',
    officialLabel: 'Avoid unregistered loan apps — check sachet.rbi.org.in',
    roadmapPriority: 1,
    rules: { minAge: 21 },
    category: 'quick',
    backing: 'market',
    amount: { min: 25000, max: 2000000, text: 'Usually ₹25,000 to ₹20 lakh' },
    rate: 'About 10–15% at banks; up to about 24% at NBFCs',
    estimateRate: 12,
    tenure: '1 to 6 years',
    tenureMonths: 36,
    collateral: 'None',
    offers: [
      { lender: 'SBI', type: 'public-bank', rate: 'From about 10% (Xpress Credit for salaried)', rateFrom: 10, note: 'Fee about 1–1.5%', url: 'https://sbi.co.in/web/personal-banking/loans/personal-loans' },
      { lender: 'HDFC Bank', type: 'private-bank', rate: 'About 9.99% to 24%', rateFrom: 9.99, note: 'Fee up to ₹6,500 + GST', url: 'https://www.hdfcbank.com' },
      { lender: 'Bajaj Finance', type: 'nbfc', rate: 'Higher than banks — check the quote', url: 'https://www.bajajfinserv.in' },
    ],
    checked: CHECKED,
  },
];

/** Every loan the finder shows: loan products plus the loan schemes in the scheme catalog. */
export type LoanListing = CatalogScheme & LoanDetails & { kind?: 'loan' | 'scheme' };

export const LOAN_LISTINGS: LoanListing[] = [
  ...SCHEME_CATALOG.filter((s) => SCHEME_LOAN_DETAILS[s.id]).map((s) => ({ ...s, ...SCHEME_LOAN_DETAILS[s.id], kind: 'scheme' as const })),
  ...LOAN_PRODUCTS,
];

export const loanDetails = (id: string): LoanDetails | null => LOAN_PRODUCTS.find((l) => l.id === id) || SCHEME_LOAN_DETAILS[id] || null;

/** Lender names for the form's "which lender" question. */
export const lenderOptions = (id: string) => [...(loanDetails(id)?.offers || []).map((o) => o.lender), 'Not decided — help me choose'];

/** Monthly instalment (EMI) for a loan; an estimate only. */
export function emi(principal: number, yearlyRatePct: number, months: number): number {
  if (!(principal > 0) || !(months > 0)) return 0;
  const r = yearlyRatePct / 12 / 100;
  if (r === 0) return Math.round(principal / months);
  const f = Math.pow(1 + r, months);
  return Math.round((principal * r * f) / (f - 1));
}

/** The rate to estimate with: the chosen lender's lowest figure, else the loan's typical rate. */
export function rateFor(id: string, lender?: string): { rate: number; from: 'lender' | 'typical' } {
  const d = loanDetails(id);
  const offer = d?.offers.find((o) => o.lender === lender);
  if (offer?.rateFrom) return { rate: offer.rateFrom, from: 'lender' };
  return { rate: d?.estimateRate ?? 12, from: 'typical' };
}

export const formatRupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Words for "loan" in the app's languages. */
export const LOAN_WORDS = /\b(loan|loans|credit|finance|borrow|emi|karz|karza|rin)\b|लोन|ऋण|कर्ज|क़र्ज़|कर्ज़|கடன்|రుణం|అప్పు|ಸಾಲ|വായ്പ|ঋণ|লোন|લોન|ધિરાણ|ਕਰਜ਼ਾ|ਲੋਨ|ଋଣ|قرض|لون/i;
