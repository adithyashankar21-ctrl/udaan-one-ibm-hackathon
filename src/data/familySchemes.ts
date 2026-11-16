/**
 * Whole-family entitlements: who in a household may qualify for which well-known central
 * scheme. Matching is plain rules (no AI guessing), so the same family always gets the same
 * answer. Benefits are kept to long-standing public facts; States add their own top-ups and
 * rules change — every card points to the official site and says "confirm there".
 */

export type Relation = 'self' | 'spouse' | 'mother' | 'father' | 'son' | 'daughter' | 'grandmother' | 'grandfather' | 'sister' | 'brother' | 'other';
export type Study = 'none' | 'school' | 'college';
export type Work = 'none' | 'seeking' | 'farmer' | 'unorganised' | 'artisan' | 'salaried' | 'business';

export interface Member {
  id: string;
  relation: Relation;
  name?: string;
  age?: number;
  gender?: 'Female' | 'Male' | 'Other';
  study?: Study;
  work?: Work;
  pregnant?: boolean;
  widow?: boolean;
  disability?: boolean;
}

export interface Household {
  members: Member[];
  area?: 'rural' | 'urban';
  category?: 'SC' | 'ST' | 'OBC' | 'General' | 'EWS';
  /** Yearly income of the whole family, rupees. */
  annualIncome?: number;
  /** Has a BPL / Antyodaya / priority-household ration card. */
  bpl?: boolean;
  /** Lives in a pucca (permanent) house. */
  pucca?: boolean;
  hasLpg?: boolean;
  ownsFarmland?: boolean;
}

export type Fit = 'likely' | 'check';

export interface FamilyScheme {
  id: string;
  name: string;
  benefit: string;
  url: string;
  label: string;
  /** Smart Apply form id, when UDAAN ONE can fill the application. */
  applyId?: string;
}

export interface FamilyMatch {
  scheme: FamilyScheme;
  fit: Fit;
  why: string;
}

export const RELATIONS: Array<{ id: Relation; label: string }> = [
  { id: 'self', label: 'Me' },
  { id: 'spouse', label: 'Wife / husband' },
  { id: 'mother', label: 'Mother' },
  { id: 'father', label: 'Father' },
  { id: 'son', label: 'Son' },
  { id: 'daughter', label: 'Daughter' },
  { id: 'grandmother', label: 'Grandmother' },
  { id: 'grandfather', label: 'Grandfather' },
  { id: 'sister', label: 'Sister' },
  { id: 'brother', label: 'Brother' },
  { id: 'other', label: 'Other' },
];
export const relationLabel = (r: Relation) => RELATIONS.find((x) => x.id === r)?.label || 'Family member';

export const WORK_LABEL: Record<Work, string> = {
  none: 'Not working',
  seeking: 'Looking for work',
  farmer: 'Farmer',
  unorganised: 'Daily wage / informal work',
  artisan: 'Artisan / craftsperson',
  salaried: 'Salaried job',
  business: 'Own business',
};

/** Female / male implied by the relation, when the person has not said. */
export function genderOf(m: Member): Member['gender'] {
  if (m.gender) return m.gender;
  if (['mother', 'daughter', 'grandmother', 'sister'].includes(m.relation)) return 'Female';
  if (['father', 'son', 'grandfather', 'brother'].includes(m.relation)) return 'Male';
  return undefined;
}

const S = {
  vayVandana: {
    id: 'ab-vay-vandana',
    name: 'Ayushman Vay Vandana card (70+)',
    benefit: 'Free hospital treatment up to ₹5 lakh a year in empanelled hospitals — for everyone aged 70 or more, whatever the income.',
    url: 'https://beneficiary.nha.gov.in',
    label: 'beneficiary.nha.gov.in',
  },
  oldAge: {
    id: 'ignoaps',
    name: 'Old age pension (IGNOAPS)',
    benefit: 'A monthly pension: ₹200 (age 60–79) or ₹500 (80+) from the Centre, plus a top-up from most States.',
    url: 'https://nsap.nic.in',
    label: 'nsap.nic.in',
  },
  widow: {
    id: 'ignwps',
    name: 'Widow pension (IGNWPS)',
    benefit: 'A monthly pension for widows aged 40–79 from poor households, plus a State top-up.',
    url: 'https://nsap.nic.in',
    label: 'nsap.nic.in',
  },
  disabilityPension: {
    id: 'igndps',
    name: 'Disability pension (IGNDPS)',
    benefit: 'A monthly pension for people aged 18–79 with severe (80%+) disability from poor households.',
    url: 'https://nsap.nic.in',
    label: 'nsap.nic.in',
  },
  udid: {
    id: 'udid',
    name: 'UDID disability card',
    benefit: 'One card that proves disability for every benefit, concession and quota.',
    url: 'https://swavlambancard.gov.in',
    label: 'swavlambancard.gov.in',
    applyId: 'doc-udid',
  },
  pmmvy: {
    id: 'pmmvy',
    name: 'Pradhan Mantri Matru Vandana Yojana',
    benefit: '₹5,000 for the first child, and ₹6,000 if the second child is a girl — paid to the mother’s bank account.',
    url: 'https://pmmvy.wcd.gov.in',
    label: 'pmmvy.wcd.gov.in',
  },
  jsy: {
    id: 'jsy',
    name: 'Janani Suraksha Yojana',
    benefit: 'Cash help for giving birth in a government or accredited hospital. Ask the ASHA worker.',
    url: 'https://nhm.gov.in',
    label: 'nhm.gov.in',
  },
  anganwadi: {
    id: 'anganwadi',
    name: 'Anganwadi services (Poshan)',
    benefit: 'Free nutrition, health check-ups, vaccination and pre-school for children under 6 and for pregnant women.',
    url: 'https://wcd.gov.in',
    label: 'wcd.gov.in',
  },
  sukanya: {
    id: 'sukanya',
    name: 'Sukanya Samriddhi account',
    benefit: 'A high-interest savings account for a girl under 10, opened at a post office or bank from ₹250.',
    url: 'https://www.indiapost.gov.in',
    label: 'indiapost.gov.in',
  },
  postMatricSc: {
    id: 'post-matric-sc',
    name: 'Post-matric scholarship for SC students',
    benefit: 'Fees and a monthly allowance for studies after class 10, for SC students with family income up to ₹2.5 lakh.',
    url: 'https://scholarships.gov.in',
    label: 'scholarships.gov.in',
    applyId: 'post-matric-sc',
  },
  preMatric: {
    id: 'pre-matric',
    name: 'Pre-matric scholarship (class 9–10)',
    benefit: 'Yearly help for school students in class 9 and 10 from SC, ST, OBC and minority families.',
    url: 'https://scholarships.gov.in',
    label: 'scholarships.gov.in',
  },
  nsp: {
    id: 'nsp',
    name: 'Scholarships on the National Scholarship Portal',
    benefit: 'Central and State scholarships for your category and course, in one place.',
    url: 'https://scholarships.gov.in',
    label: 'scholarships.gov.in',
  },
  pmkvy: {
    id: 'pmkvy',
    name: 'PMKVY free skill training',
    benefit: 'Free short courses with a certificate and help finding a job.',
    url: 'https://www.skillindiadigital.gov.in',
    label: 'skillindiadigital.gov.in',
    applyId: 'pmkvy',
  },
  ncs: {
    id: 'ncs',
    name: 'National Career Service jobs',
    benefit: 'Free job listings, job fairs and career counselling.',
    url: 'https://www.ncs.gov.in',
    label: 'ncs.gov.in',
    applyId: 'ncs',
  },
  vishwakarma: {
    id: 'pm-vishwakarma',
    name: 'PM Vishwakarma',
    benefit: 'Training with a daily stipend, a ₹15,000 toolkit voucher and low-interest loans for traditional artisans.',
    url: 'https://pmvishwakarma.gov.in',
    label: 'pmvishwakarma.gov.in',
    applyId: 'pm-vishwakarma',
  },
  kisan: {
    id: 'pm-kisan',
    name: 'PM-KISAN',
    benefit: '₹6,000 a year in three instalments to farmer families who own farmland.',
    url: 'https://pmkisan.gov.in',
    label: 'pmkisan.gov.in',
  },
  eshram: {
    id: 'eshram',
    name: 'e-Shram card',
    benefit: 'A free card for informal workers aged 16–59 that links you to welfare schemes for workers.',
    url: 'https://eshram.gov.in',
    label: 'eshram.gov.in',
    applyId: 'doc-eshram',
  },
  maandhan: {
    id: 'pm-sym',
    name: 'PM Shram Yogi Maan-dhan pension',
    benefit: '₹3,000 a month after age 60. You pay ₹55–200 a month and the government pays the same.',
    url: 'https://maandhan.in',
    label: 'maandhan.in',
  },
  shg: {
    id: 'nrlm',
    name: 'Women’s self-help group (DAY-NRLM)',
    benefit: 'Savings, low-interest loans and training through a village women’s group.',
    url: 'https://aajeevika.gov.in',
    label: 'aajeevika.gov.in',
  },
  pmjay: {
    id: 'pm-jay',
    name: 'Ayushman Bharat PM-JAY card',
    benefit: 'Free hospital treatment up to ₹5 lakh a year for the whole family in empanelled hospitals.',
    url: 'https://beneficiary.nha.gov.in',
    label: 'beneficiary.nha.gov.in',
  },
  ration: {
    id: 'ration',
    name: 'Ration card (free foodgrains)',
    benefit: 'Free foodgrains every month for priority households under PM Garib Kalyan Anna Yojana.',
    url: 'https://nfsa.gov.in',
    label: 'nfsa.gov.in',
    applyId: 'doc-ration',
  },
  ujjwala: {
    id: 'ujjwala',
    name: 'PM Ujjwala Yojana',
    benefit: 'A free LPG connection in the name of a woman of the house.',
    url: 'https://pmuy.gov.in',
    label: 'pmuy.gov.in',
  },
  pmayG: {
    id: 'pmay-g',
    name: 'PM Awas Yojana – Gramin',
    benefit: 'Help to build a pucca house for village families without one.',
    url: 'https://pmayg.dord.gov.in',
    label: 'pmayg.dord.gov.in',
  },
  pmayU: {
    id: 'pmay-u',
    name: 'PM Awas Yojana – Urban 2.0',
    benefit: 'Help to build or buy a first pucca house in a town or city.',
    url: 'https://pmay-urban.gov.in',
    label: 'pmay-urban.gov.in',
    applyId: 'loan-pmay-home',
  },
  pmAjay: {
    id: 'pm-ajay',
    name: 'PM-AJAY',
    benefit: 'Grants for income-generating assets and skill training for Scheduled Caste families.',
    url: 'https://pmajay.dosje.gov.in',
    label: 'pmajay.dosje.gov.in',
    applyId: 'pm-ajay',
  },
  insurance: {
    id: 'jan-suraksha',
    name: 'PM Suraksha + Jeevan Jyoti insurance',
    benefit: '₹2 lakh accident cover for ₹20 a year (age 18–70) and ₹2 lakh life cover for ₹436 a year (age 18–50), through any bank account.',
    url: 'https://jansuraksha.gov.in',
    label: 'jansuraksha.gov.in',
  },
} satisfies Record<string, FamilyScheme>;

/** Schemes that may fit one person, with the reason. */
export function matchMember(m: Member, h: Household): FamilyMatch[] {
  const out: FamilyMatch[] = [];
  const add = (scheme: FamilyScheme, fit: Fit, why: string) => out.push({ scheme, fit, why });
  const age = typeof m.age === 'number' && m.age >= 0 ? m.age : undefined;
  const female = genderOf(m) === 'Female';
  const poor = h.bpl === true;
  const poorUnknown = h.bpl === undefined;
  const incomeOk = (limit: number) => h.annualIncome === undefined || h.annualIncome <= limit;

  if (age !== undefined && age >= 70) add(S.vayVandana, 'likely', 'Everyone aged 70 or more qualifies, whatever the income.');
  if (m.widow && female && age !== undefined && age >= 40 && age <= 79 && (poor || poorUnknown)) add(S.widow, poor ? 'likely' : 'check', 'A widow aged 40–79 — for households on the BPL list.');
  // One national (NSAP) pension per person: the widow pension takes the place of the old age pension
  const widowPension = out.some((x) => x.scheme.id === 'ignwps');
  if (!widowPension && age !== undefined && age >= 60 && (poor || poorUnknown)) add(S.oldAge, poor ? 'likely' : 'check', poor ? 'Aged 60+ in a household with a BPL / priority ration card.' : 'Aged 60+ — for households on the BPL list.');
  if (m.disability) {
    add(S.udid, 'likely', 'Anyone with a disability can get the card.');
    if (age !== undefined && age >= 18 && age <= 79 && (poor || poorUnknown)) add(S.disabilityPension, 'check', 'Needs 80% or more disability and a BPL household.');
  }
  if (m.pregnant && female) {
    add(S.pmmvy, age === undefined || age >= 19 ? 'likely' : 'check', 'Pregnant — register at the Anganwadi or health centre.');
    add(S.jsy, poor || h.category === 'SC' || h.category === 'ST' ? 'likely' : 'check', 'Pregnant — the cash help is for hospital births.');
    add(S.anganwadi, 'likely', 'Pregnant women get free nutrition and check-ups.');
  }
  if (age !== undefined && age < 6) add(S.anganwadi, 'likely', 'Children under 6 get free nutrition and pre-school.');
  if (female && age !== undefined && age < 10) add(S.sukanya, 'likely', 'A girl under 10 can have this account.');

  if (m.study === 'college' || (m.study === 'school' && age !== undefined && age >= 16)) {
    if (h.category === 'SC') add(S.postMatricSc, incomeOk(250000) ? 'likely' : 'check', h.annualIncome === undefined ? 'An SC student after class 10 — family income must be up to ₹2.5 lakh.' : incomeOk(250000) ? 'An SC student after class 10, family income within ₹2.5 lakh.' : 'Family income may be above ₹2.5 lakh — check other scholarships.');
    else add(S.nsp, 'check', 'A student after class 10 — find the scholarship for your category.');
  } else if (m.study === 'school' && age !== undefined && age >= 13) {
    if (h.category && h.category !== 'General') add(S.preMatric, 'check', 'A school student from an SC, ST, OBC or minority family.');
    else add(S.nsp, 'check', 'A school student — see what scholarships fit.');
  }

  const working = age !== undefined && age >= 18;
  if (working && m.work === 'artisan') add(S.vishwakarma, 'likely', 'A traditional artisan aged 18+.');
  if (m.work === 'farmer' && h.ownsFarmland) add(S.kisan, 'likely', 'A farmer family that owns farmland. Income-tax payers are excluded.');
  if (m.work === 'farmer' && h.ownsFarmland === undefined) add(S.kisan, 'check', 'For farmer families that own farmland.');
  if (age !== undefined && age >= 16 && age <= 59 && (m.work === 'unorganised' || m.work === 'artisan' || m.work === 'farmer')) add(S.eshram, 'likely', 'Informal workers aged 16–59 can register free.');
  if (age !== undefined && age >= 18 && age <= 40 && (m.work === 'unorganised' || m.work === 'artisan')) add(S.maandhan, 'check', 'Informal workers aged 18–40 earning up to ₹15,000 a month.');
  if (age !== undefined && age >= 15 && age <= 45 && (m.work === 'seeking' || m.work === 'none') && m.study !== 'school') add(S.pmkvy, 'likely', 'Aged 15–45 and not in a job — free training.');
  if (working && m.work === 'seeking') add(S.ncs, 'likely', 'Looking for work.');
  if (female && working && h.area === 'rural' && m.work !== 'salaried') add(S.shg, 'check', 'Women in villages can join or form a group.');
  return out;
}

/** Schemes that are applied for once for the whole household. */
export function matchHousehold(h: Household): FamilyMatch[] {
  const out: FamilyMatch[] = [];
  const add = (scheme: FamilyScheme, fit: Fit, why: string) => out.push({ scheme, fit, why });
  const adults = h.members.filter((m) => (m.age ?? 18) >= 18);
  const womanAdult = adults.some((m) => genderOf(m) === 'Female');
  const scst = h.category === 'SC' || h.category === 'ST';

  add(S.pmjay, h.bpl ? 'likely' : 'check', h.bpl ? 'Households with a priority / Antyodaya ration card are usually on the list.' : 'Check if your family is on the list — enter your mobile or ration card number on the site.');
  if (!h.bpl) add(S.ration, 'check', 'If your family is poor and has no priority ration card, apply for one.');
  if (h.hasLpg === false && womanAdult) add(S.ujjwala, h.bpl || scst ? 'likely' : 'check', 'No LPG connection at home, and an adult woman to hold it.');
  if (h.pucca === false) add(h.area === 'urban' ? S.pmayU : S.pmayG, 'likely', 'The family does not live in a pucca house.');
  if (h.category === 'SC') add(S.pmAjay, 'check', 'For Scheduled Caste families, through the district office.');
  if (adults.length) add(S.insurance, 'likely', 'Every adult with a bank account can join — very low yearly cost.');
  return out;
}

export function familySummary(h: Household) {
  const people = h.members.map((m) => ({ member: m, matches: matchMember(m, h) }));
  const household = matchHousehold(h);
  const ids = new Set([...people.flatMap((p) => p.matches.map((x) => `${p.member.id}:${x.scheme.id}`)), ...household.map((x) => `home:${x.scheme.id}`)]);
  const likely = people.reduce((n, p) => n + p.matches.filter((x) => x.fit === 'likely').length, 0) + household.filter((x) => x.fit === 'likely').length;
  return { people, household, total: ids.size, likely };
}

export const newMemberId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (allowed.includes(v as T) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const RELATION_IDS = RELATIONS.map((r) => r.id);

/** Keep only well-formed household facts (used for what the AI heard and what the server stores). */
export function cleanHousehold(raw: any): Household {
  const members: Member[] = (Array.isArray(raw?.members) ? raw.members : []).slice(0, 15).map((m: any) => {
    const age = m?.age == null || m.age === '' ? NaN : Number(m.age);
    return {
      id: typeof m?.id === 'string' && /^[\w-]{1,40}$/.test(m.id) ? m.id : newMemberId(),
      relation: pick(m?.relation, RELATION_IDS) || 'other',
      name: typeof m?.name === 'string' ? m.name.slice(0, 60) : undefined,
      age: Number.isFinite(age) && age >= 0 && age <= 120 ? Math.round(age) : undefined,
      gender: pick(m?.gender, ['Female', 'Male', 'Other'] as const),
      study: pick(m?.study, ['none', 'school', 'college'] as const),
      work: pick(m?.work, ['none', 'seeking', 'farmer', 'unorganised', 'artisan', 'salaried', 'business'] as const),
      pregnant: bool(m?.pregnant),
      widow: bool(m?.widow),
      disability: bool(m?.disability),
    };
  });
  const income = Number(raw?.annualIncome);
  return {
    members,
    area: pick(raw?.area, ['rural', 'urban'] as const),
    category: pick(raw?.category, ['SC', 'ST', 'OBC', 'General', 'EWS'] as const),
    annualIncome: Number.isFinite(income) && income >= 0 && income < 1e9 ? Math.round(income) : undefined,
    bpl: bool(raw?.bpl),
    pucca: bool(raw?.pucca),
    hasLpg: bool(raw?.hasLpg),
    ownsFarmland: bool(raw?.ownsFarmland),
  };
}
