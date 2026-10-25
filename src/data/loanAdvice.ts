/**
 * Loan advice that runs instantly in the browser (and on the server for the voice channels):
 * ranking loans for one person, the repayment reality check, loan + skill bundles, the
 * fraud shield's rules and what to expect at the bank. No AI here — the AI only turns what
 * people say into a LoanNeed (server/loans).
 */
import { NSQF_COURSES } from './nsqfCourses';
import { LOAN_LISTINGS, emi, formatRupees, type LoanCategory, type LoanListing } from './loanCatalog';

/** What we know about the person and what they need. Everything is optional. */
export interface LoanNeed {
  purpose?: LoanCategory;
  amount?: number;
  /** In their words: "a tailoring shop", "two buffaloes". */
  activity?: string;
  stage?: 'new' | 'existing';
  socialCategory?: 'SC' | 'ST' | 'OBC' | 'General' | 'EWS';
  minority?: boolean;
  gender?: 'Female' | 'Male' | 'Other';
  /** Household income per month (₹). */
  monthlyIncome?: number;
  /** EMIs already paid every month (₹). */
  existingEmi?: number;
  /** Special groups some loans are made for. */
  roles?: Array<'vendor' | 'artisan' | 'farmer' | 'student' | 'shg' | 'sanitation'>;
  hasGold?: boolean;
  months?: number;
}

type Tag = 'sc' | 'st' | 'obc' | 'minority' | 'woman' | 'vendor' | 'artisan' | 'farmer' | 'student' | 'shg' | 'sanitation' | 'gold';

/** Who each loan is for and which needs it also serves. Loans without `who` are open to all. */
const FIT: Record<string, { who?: Tag[]; also?: LoanCategory[]; newOnly?: boolean; firstMax?: number; firstNote?: string }> = {
  mudra: { also: ['micro', 'women'] },
  nsfdc: { who: ['sc'], also: ['business', 'agriculture', 'micro'] },
  'stand-up-india': { who: ['sc', 'st', 'woman'], also: ['business'], newOnly: true },
  'pm-vishwakarma': { who: ['artisan'], also: ['micro'], firstMax: 100000, firstNote: 'The first loan is up to ₹1 lakh (repaid in 18 months); up to ₹2 lakh more comes after repaying it' },
  'loan-pmegp': { newOnly: true, also: ['women', 'community'] },
  'loan-cgtmse': { also: ['women'] },
  'loan-business': {},
  'loan-svanidhi': { who: ['vendor'], also: ['business'] },
  'loan-microfinance': { also: ['business', 'women'] },
  'loan-shg': { who: ['shg'], also: ['business', 'micro', 'agriculture'] },
  'loan-kcc': { who: ['farmer'] },
  'loan-ahidf': { also: ['business'] },
  'loan-vidyalaxmi': { who: ['student'] },
  'loan-education': { who: ['student'] },
  'loan-pmay-home': {},
  'loan-home': {},
  'loan-nbcfdc': { who: ['obc'], also: ['business', 'agriculture', 'micro'] },
  'loan-nskfdc': { who: ['sanitation'], also: ['business', 'micro'] },
  'loan-nmdfc': { who: ['minority'], also: ['business', 'agriculture', 'micro'] },
  'loan-gold': { who: ['gold'], also: ['business', 'agriculture', 'education', 'micro'] },
  'loan-personal': {},
};

const TAG_LABEL: Record<Tag, string> = {
  sc: 'Scheduled Caste applicants',
  st: 'Scheduled Tribe applicants',
  obc: 'Backward Class (OBC) applicants',
  minority: 'minority communities',
  woman: 'women',
  vendor: 'street vendors',
  artisan: 'traditional artisans',
  farmer: 'farmers, dairy and fisheries',
  student: 'students',
  shg: 'self-help groups',
  sanitation: 'sanitation workers',
  gold: 'people with gold to pledge',
};

/** Tags the person matches (true), clearly does not match (false), or we do not know (undefined). */
function matches(tag: Tag, n: LoanNeed): boolean | undefined {
  const role = (r: NonNullable<LoanNeed['roles']>[number]) => (n.roles ? n.roles.includes(r) : undefined);
  switch (tag) {
    case 'sc':
    case 'st':
    case 'obc':
      return n.socialCategory ? n.socialCategory === tag.toUpperCase() : undefined;
    case 'minority':
      return n.minority;
    case 'woman':
      return n.gender ? n.gender === 'Female' : undefined;
    case 'gold':
      return n.hasGold;
    default:
      return role(tag);
  }
}

export interface LoanMatch {
  loan: LoanListing;
  score: number;
  /** Plain reasons it suits this person, best first. */
  reasons: string[];
  /** Things to check before relying on it. */
  cautions: string[];
}

export interface LoanRanking {
  matches: LoanMatch[];
  /** Loans left out, with the reason — shown so people see why. */
  excluded: Array<{ loan: LoanListing; why: string }>;
}

const collateralFree = (l: LoanListing) => /^no collateral|^none|no collateral|without collateral/i.test(l.collateral);

/** Ranks every loan for this person. Preliminary: the lender decides. */
export function rankLoans(n: LoanNeed): LoanRanking {
  const matchesOut: LoanMatch[] = [];
  const excluded: LoanRanking['excluded'] = [];
  const yearly = n.monthlyIncome ? n.monthlyIncome * 12 : undefined;

  for (const loan of LOAN_LISTINGS) {
    const fit = FIT[loan.id] || {};
    const reasons: string[] = [];
    const cautions: string[] = [];
    let score = 50;

    if (n.purpose) {
      if (loan.category === n.purpose) score += 30;
      else if (fit.also?.includes(n.purpose)) score += 18;
      else {
        excluded.push({ loan, why: 'Made for a different need' });
        continue;
      }
    }

    if (fit.who) {
      const known = fit.who.map((t) => matches(t, n));
      const hit = fit.who.find((t, i) => known[i]);
      if (hit) {
        score += 25;
        reasons.push(`Made for ${TAG_LABEL[hit]} — that is you`);
      } else if (known.every((k) => k === false)) {
        excluded.push({ loan, why: `Only for ${fit.who.map((t) => TAG_LABEL[t]).join(' or ')}` });
        continue;
      } else {
        // Not confirmed: keep it on the list, below loans the person surely qualifies for
        score -= 22;
        cautions.push(`Only for ${fit.who.map((t) => TAG_LABEL[t]).join(' or ')}`);
      }
    }

    if (fit.newOnly && n.stage === 'existing') {
      excluded.push({ loan, why: 'Only for starting a new business' });
      continue;
    }
    if (loan.rules.maxAnnualIncome && yearly && yearly > loan.rules.maxAnnualIncome) {
      excluded.push({ loan, why: `Family income must be under ${formatRupees(loan.rules.maxAnnualIncome)} a year` });
      continue;
    }

    if (n.amount) {
      if (loan.amount.max && n.amount > loan.amount.max) {
        score -= 30;
        cautions.push(`Goes only up to ${formatRupees(loan.amount.max)}`);
      } else if (loan.amount.min && n.amount < loan.amount.min) {
        score -= 15;
        cautions.push(`Usually starts at ${formatRupees(loan.amount.min)}`);
      } else if (fit.firstMax && n.amount > fit.firstMax) {
        cautions.push(fit.firstNote || `The first loan is up to ${formatRupees(fit.firstMax)}`);
      } else if (loan.amount.max || loan.amount.min) {
        score += 8;
        reasons.push(`${formatRupees(n.amount)} fits its limit`);
      }
      // A loan the person can't repay is never the best one for them
      if (n.monthlyIncome) {
        const a = affordability(n.amount, loan.estimateRate, n.months || loan.tenureMonths, n.monthlyIncome, n.existingEmi || 0);
        if (a.verdict === 'fits') {
          score += 10;
          reasons.push('The EMI fits your budget');
        } else if (a.verdict === 'tight') {
          score -= 8;
          cautions.push('The EMI would stretch your budget');
        } else if (a.verdict === 'heavy') {
          score -= 20;
          cautions.push('The EMI would be too heavy for your income');
        }
      }
    }

    score += Math.max(0, 22 - loan.estimateRate) * 1.5;
    if (loan.subsidy) {
      score += 8;
      reasons.push(`Government help: ${loan.subsidy}`);
    }
    if (collateralFree(loan)) {
      score += 6;
      reasons.push('No collateral needed');
    }
    if (loan.backing === 'government') score += 6;
    else cautions.push('A lender’s own product — usually costs more than government-backed loans');
    if (loan.statusNote) {
      score -= 25;
      cautions.push(loan.statusNote);
    }
    matchesOut.push({ loan, score, reasons, cautions });
  }

  matchesOut.sort((a, b) => b.score - a.score);
  // Say which one is cheapest among the good matches
  const top = matchesOut.slice(0, 4).filter((m) => !m.cautions.some((c) => c.startsWith('Only for')));
  const cheapest = top.reduce<LoanMatch | null>((c, m) => (!c || m.loan.estimateRate < c.loan.estimateRate ? m : c), null);
  if (cheapest) cheapest.reasons.unshift('Lowest cost of your best options');
  return { matches: matchesOut, excluded };
}

/** One-line headline for a match: "Lowest cost · No collateral needed". */
export const headline = (m: LoanMatch) => m.reasons.slice(0, 2).join(' · ');

/* ── Repayment reality check ─────────────────────────────────────────── */

export interface Affordability {
  emi: number;
  /** EMIs a household can usually carry without strain: 40% of income, minus what they already pay. */
  safeEmi: number;
  /** The most anyone should go to: 50% of income (RBI's limit for microfinance). */
  maxEmi: number;
  verdict: 'fits' | 'tight' | 'heavy' | 'unknown';
  /** The biggest loan whose EMI fits the safe level at this rate and period. */
  safeAmount: number;
  /** The shortest period at which this amount fits the safe level (months), if any up to 20 years. */
  safeMonths?: number;
}

export function affordability(amount: number, ratePct: number, months: number, monthlyIncome?: number, existingEmi = 0): Affordability {
  const instalment = emi(amount, ratePct, months);
  if (!monthlyIncome) return { emi: instalment, safeEmi: 0, maxEmi: 0, verdict: 'unknown', safeAmount: 0 };
  const safeEmi = Math.max(0, Math.round(monthlyIncome * 0.4 - existingEmi));
  const maxEmi = Math.max(0, Math.round(monthlyIncome * 0.5 - existingEmi));
  const perRupee = emi(100000, ratePct, months) / 100000;
  const safeAmount = perRupee > 0 ? Math.floor(safeEmi / perRupee / 1000) * 1000 : 0;
  let safeMonths: number | undefined;
  for (const m of [12, 18, 24, 36, 48, 60, 84, 120, 180, 240]) {
    if (m >= months && emi(amount, ratePct, m) <= safeEmi) {
      safeMonths = m;
      break;
    }
  }
  const verdict = instalment <= safeEmi ? 'fits' : instalment <= maxEmi ? 'tight' : 'heavy';
  return { emi: instalment, safeEmi, maxEmi, verdict, safeAmount, safeMonths };
}

/** Turns "2 lakh", "50 hazar", "₹1,20,000", "२ लाख" into rupees. */
export function parseAmount(raw: string): number | null {
  const ascii = raw.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d))).replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  const s = ascii.toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr|rupees?|रुपये|रुपए/g, ' ');
  const num = s.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  let n = Number(num[1]);
  if (/lakh|lac|लाख|ലക്ഷ|லட்ச|లక్ష|ಲಕ್ಷ|লাখ|લાખ|ਲੱਖ|ଲକ୍ଷ|لاکھ/.test(s)) n *= 100000;
  else if (/crore|करोड़|कोटी|கோடி|కోట్ల|ಕೋಟಿ|കോടി|কোটি|કરોડ|ਕਰੋੜ|କୋଟି|کروڑ/.test(s)) n *= 10000000;
  else if (/thousand|hazar|हज़ार|हजार|ஆயிரம்|వేల|ಸಾವಿರ|ആയിരം|হাজার|હજાર|ਹਜ਼ਾਰ|ହଜାର|ہزار|\bk\b/.test(s)) n *= 1000;
  return isFinite(n) && n > 0 ? Math.round(n) : null;
}

/* ── Loan + skill bundle ─────────────────────────────────────────────── */

export interface SkillBundle {
  title: string;
  why: string;
  course?: { name: string; duration: string; certifiedBy?: string; stipend: boolean };
  /** A Learning Hub topic to open for free lessons. */
  learnTopic: string;
}

const ACTIVITY_COURSE: Array<[RegExp, string]> = [
  [/tailor|stitch|sewing|garment|boutique|silai|सिलाई|दर्जी|கைத்தறி|தையல்|కుట్టు|ಹೊಲಿಗೆ|തയ്യൽ/i, 'amf-q1101'],
  [/weav|handloom|loom|बुनकर|हथकरघा|நெசவு|నేత|ನೇಕಾರ|നെയ്ത്ത്/i, 'hcs-q0101'],
  [/leather|bag|चमड़ा|தோல்|తోలు|ಚರ್ಮ|തുകൽ/i, 'lss-q5501'],
  [/shoe|footwear|cobbler|मोची|जूता|செருப்பு|చెప్పు|ಚಪ್ಪಲಿ|ചെരുപ്പ്/i, 'lss-q2301'],
  [/solar|सोलर|சோலார்|సోలార్|ಸೋಲಾರ್|സോളാർ/i, 'sgj-q0101'],
  [/pump|irrigat|पंप|பம்ப்|పంపు|ಪಂಪ್|പമ്പ്/i, 'sgj-q0201'],
  [/bike|scooter|two.?wheeler|mechanic|garage|ev\b|electric vehicle|गाड़ी|मैकेनिक|மெக்கானிக்|మెకానిక్|ಮೆಕ್ಯಾನಿಕ್|മെക്കാനിക്/i, 'asc-q1402'],
  [/mason|tile|construct|मिस्त्री|राजमिस्त्री|கொத்தனார்|మేస్త్రి|ಮೇಸ್ತ್ರಿ|മേസ്തിരി/i, 'con-q0101'],
  [/dairy|milk|cow|buffalo|cattle|goat|डेयरी|दूध|गाय|भैंस|பால்|மாடு|పాలు|గేదె|ಹಾಲು|ಎಮ್ಮೆ|പാൽ|പശു/i, 'agr-q1101'],
  [/computer|cyber|csc|data entry|typing|xerox|कंप्यूटर|கணினி|కంప్యూటర్|ಕಂಪ್ಯೂಟರ್|കമ്പ്യൂട്ടർ/i, 'ssc-q0101'],
  [/electric|repair|appliance|wiring|fan|बिजली|इलेक्ट्रि|மின்|ఎలక్ట్రి|ಎಲೆಕ್ಟ್ರಿ|ഇലക്ട്രി/i, 'ele-q3104'],
  [/health|nurse|clinic|care|स्वास्थ्य|நர்ஸ்|నర్సు|ನರ್ಸ್|നഴ്സ്/i, 'hss-q5101'],
];

/** A course that raises the chance the loan-funded work succeeds. */
export function skillBundleFor(loanId: string, activity = ''): SkillBundle {
  const id = ACTIVITY_COURSE.find(([re]) => re.test(activity))?.[1];
  const c = id ? NSQF_COURSES.find((x) => x.id === id) : undefined;
  const course = c ? { name: c.jobRole, duration: c.durationHours, certifiedBy: c.certifyingBody, stipend: c.stipendSupported } : undefined;
  if (loanId === 'loan-pmegp') {
    return { title: 'PMEGP loan + Entrepreneurship Development Programme (EDP)', why: 'The EDP training is required before the PMEGP subsidy is released, and it teaches costing, accounts and marketing.', course, learnTopic: 'Running a small business: costing, accounts and marketing' };
  }
  if (loanId === 'pm-vishwakarma') {
    return { title: 'PM Vishwakarma credit + basic skill training', why: 'Registered artisans get basic training with a daily stipend and a toolkit incentive before the first loan.', course, learnTopic: `Modern tools and selling online for ${activity || 'artisans'}` };
  }
  if (c) {
    return { title: `Loan + certified course: ${c.jobRole}`, why: `A certified course (${c.certifyingBody || 'NSQF'}) shows the bank you have the skill, and helps the business earn enough to repay.`, course, learnTopic: c.jobRole };
  }
  const topic = activity ? `How to run ${activity} profitably` : 'Money basics: budgeting, saving and repaying a loan on time';
  return { title: 'Loan + free business skills lessons', why: 'Learning to keep accounts and price your work well is the biggest factor in repaying on time.', learnTopic: topic };
}

/* ── Fraud shield ────────────────────────────────────────────────────── */

export interface FraudFlag {
  level: 'danger' | 'warning';
  title: string;
  advice: string;
}

const FRAUD_RULES: Array<[RegExp, FraudFlag]> = [
  [/(processing|file|registration|insurance|advance|token|approval|gst|stamp)\s*(fee|charge|amount)|pay\s*(first|before|advance|₹|rs)|fee.{0,20}(before|first)|पहले.{0,15}(फीस|शुल्क|पैसे)|एडवांस/i, { level: 'danger', title: 'Asks for money before the loan', advice: 'Real lenders take fees out of the loan or charge them only after sanction. Never pay anyone to “get approval”.' }],
  [/guarantee[d]?\s*(approval|loan|sanction)|100\s*%\s*(approval|loan)|no\s*(cibil|credit)\s*check|without (any )?documents|instant approval.*no doc|बिना (कागज|दस्तावेज)|गारंटी.{0,10}लोन/i, { level: 'danger', title: 'Promises a sure loan', advice: 'No real lender guarantees approval or skips checks. This is a common trick.' }],
  [/\b(otp|pin|cvv|password|upi pin|mpin)\b|ओटीपी|पिन बताएं/i, { level: 'danger', title: 'Asks for your OTP, PIN or password', advice: 'Never share an OTP, UPI PIN or password with anyone — banks never ask for them.' }],
  [/anydesk|teamviewer|quicksupport|screen\s*share|download.{0,20}\.apk|\.apk\b/i, { level: 'danger', title: 'Asks you to install an app or share your screen', advice: 'Apps sent by message (APK files) and screen-sharing apps let fraudsters take over your phone.' }],
  [/wa\.me|whatsapp me|call\s*(on|at)?\s*\+?\d{10}|personal number|agent/i, { level: 'warning', title: 'Comes from a personal number or “agent”', advice: 'Banks contact you from official numbers and sites. Check the lender yourself on sachet.rbi.org.in or its official website.' }],
  [/bit\.ly|tinyurl|goo\.gl|t\.me\/|\.(xyz|top|click|loan|online|site|info)\b/i, { level: 'warning', title: 'Short or unofficial web link', advice: 'Open the lender’s site by typing its name yourself, not from a link in a message.' }],
  [/today only|last chance|within \d+ (hours|minutes)|urgent|immediately|आज ही|तुरंत/i, { level: 'warning', title: 'Rushes you', advice: 'Pressure to decide fast is a warning sign. A genuine offer will still be there tomorrow.' }],
  [/aadhaar.{0,30}(photo|copy|send)|send.{0,20}(aadhaar|pan|photo|selfie)/i, { level: 'warning', title: 'Asks you to send ID photos by chat', advice: 'Share documents only on the lender’s official app or at the branch.' }],
];

/** Instant rule-based check of a loan message, call script or app description. */
export function fraudFlags(text: string): FraudFlag[] {
  const seen = new Set<string>();
  return FRAUD_RULES.filter(([re]) => re.test(text))
    .map(([, f]) => f)
    .filter((f) => !seen.has(f.title) && Boolean(seen.add(f.title)));
}

export const FRAUD_BASICS: FraudFlag[] = [
  { level: 'danger', title: 'Never pay to get a loan', advice: 'Fees are deducted from the loan or paid at the branch after sanction — never to an agent first.' },
  { level: 'danger', title: 'Never share OTP, UPI PIN or passwords', advice: 'No bank or government office will ever ask for them.' },
  { level: 'warning', title: 'Check the lender is registered', advice: 'Search the name on sachet.rbi.org.in (RBI) before you apply; use only official websites and apps.' },
  { level: 'warning', title: 'Government loans have no agents', advice: 'MUDRA, PMEGP, SVANidhi and other schemes are applied for at banks, CSCs or official portals — free of charge.' },
  { level: 'warning', title: 'Read the Key Fact Statement', advice: 'Every lender must give one, showing the full yearly cost (APR) and all fees, before you sign.' },
];

export const OFFICIAL_HELP = [
  { label: 'Check a lender (RBI Sachet)', url: 'https://sachet.rbi.org.in' },
  { label: 'Report cyber fraud — call 1930', url: 'https://cybercrime.gov.in' },
  { label: 'RBI complaints (CMS)', url: 'https://cms.rbi.org.in' },
];

/* ── Bank visit guide ───────────────────────────────────────────────── */

export interface VisitGuide {
  where: string;
  /** Words to look up on a map: "SBI", "bank", "Common Service Centre". */
  searchFor: string;
  carry: string[];
  steps: string[];
}

export function visitGuideFor(loan: LoanListing, lender?: string): VisitGuide {
  // Loans from national corporations go through a State office; everything else through a bank
  const office = loan.offers.length === 1 && /State|Corporation|Agency/.test(loan.offers[0].lender);
  const searchFor = lender && !/not decided|portal|online|centre|other/i.test(lender) ? lender : office ? 'District Social Welfare Office' : 'bank';
  return {
    where: lender && !/not decided/i.test(lender) ? lender : loan.offers.map((o) => o.lender).slice(0, 3).join(', '),
    searchFor,
    carry: [...loan.documents, 'Originals and one self-attested photocopy of each', '2 passport-size photos', 'Your UDAAN ONE application printout (PDF)'],
    steps: [
      'Go on a weekday morning; ask at the enquiry desk for the loan officer',
      'Say which loan you want and show your printout — they will give their own form',
      'Hand over copies; they check originals and may visit your home or work place',
      `Ask for the sanction letter and Key Fact Statement before you sign${loan.subsidy ? ', and how the government help is credited' : ''}`,
      'Keep the acknowledgement or application number',
    ],
  };
}
