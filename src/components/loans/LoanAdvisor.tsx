import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, BadgeCheck, BookOpen, ChevronDown, FileText, MapPin, MessageCircle, Mic, MicOff, RotateCcw, ScanLine, Send, ShieldAlert, Sparkles, Square } from 'lucide-react';
import type { BeneficiaryProfile, Language } from '../../types';
import { FORM_SCHEMA_MAP } from '../../data/autofillSchema';
import { formatRupees, LOAN_CATEGORIES, rateFor, type LoanCategory } from '../../data/loanCatalog';
import { affordability, headline, parseAmount, rankLoans, skillBundleFor, type LoanMatch, type LoanNeed } from '../../data/loanAdvice';
import { loanApi } from '../../services/loanApi';
import { spokenIn } from '../../services/translate';
import { useDictation, useVoiceTurns } from '../smartapply/media';
import { Spinner, StatusPill } from '../ui/kit';

export type LoanTool = 'budget' | 'plan' | 'contract' | 'fraud' | 'bank';

interface Props {
  profile: BeneficiaryProfile;
  langConfig: Language;
  /** Start the application with the answers already given. */
  onApply: (loanId: string, values: Record<string, string>, byVoice: boolean) => void;
  onLearn: (topic: string) => void;
  onTool: (tool: LoanTool, loanId?: string, need?: LoanNeed) => void;
}

type Key = 'story' | 'purpose' | 'amount' | 'stage' | 'role' | 'category' | 'gender' | 'income' | 'emi' | 'gold';

interface Question {
  key: Key;
  text: string;
  options?: Array<{ label: string; set: Partial<LoanNeed> }>;
  number?: boolean;
}

const ROLE_OPTIONS: Question['options'] = [
  { label: 'Street vendor', set: { roles: ['vendor'] } },
  { label: 'Traditional artisan (tailor, carpenter, potter…)', set: { roles: ['artisan'] } },
  { label: 'Farmer, dairy or fisheries', set: { roles: ['farmer'] } },
  { label: 'Student', set: { roles: ['student'] } },
  { label: 'Self-help group member', set: { roles: ['shg'] } },
  { label: 'Sanitation worker', set: { roles: ['sanitation'] } },
  { label: 'None of these', set: { roles: [] } },
];

/** The next thing to ask, or null when there is enough to recommend. */
function nextQuestion(n: LoanNeed, asked: Set<Key>): Question | null {
  const q = (key: Key, make: () => Question): Question | null => (asked.has(key) ? null : make());
  const business = !n.purpose || ['business', 'micro', 'women', 'community', 'agriculture'].includes(n.purpose);
  return (
    q('story', () => ({ key: 'story', text: 'Tell me in your own words: what do you need the money for, and roughly how much?' })) ||
    (!n.purpose
      ? q('purpose', () => ({ key: 'purpose', text: 'What is the loan for?', options: LOAN_CATEGORIES.map((c) => ({ label: c.label, set: { purpose: c.id } })) }))
      : null) ||
    (!n.amount ? q('amount', () => ({ key: 'amount', text: 'How much money do you need, in rupees?', number: true })) : null) ||
    (business && !n.stage && n.purpose !== 'agriculture'
      ? q('stage', () => ({ key: 'stage', text: 'Is this a new business, or one you already run?', options: [{ label: 'New business', set: { stage: 'new' } }, { label: 'Already running', set: { stage: 'existing' } }] }))
      : null) ||
    (!n.roles && n.purpose !== 'housing' ? q('role', () => ({ key: 'role', text: 'Are you any of these? Some loans are made only for them.', options: ROLE_OPTIONS })) : null) ||
    (!n.socialCategory
      ? q('category', () => ({
          key: 'category',
          text: 'Which category do you belong to? Some low-interest loans are for these groups.',
          options: [
            { label: 'SC', set: { socialCategory: 'SC' } },
            { label: 'ST', set: { socialCategory: 'ST' } },
            { label: 'OBC', set: { socialCategory: 'OBC' } },
            { label: 'General', set: { socialCategory: 'General' } },
            { label: 'Minority community', set: { minority: true } },
          ],
        }))
      : null) ||
    (!n.gender
      ? q('gender', () => ({ key: 'gender', text: 'Are you a woman or a man? Some loans give women better terms.', options: [{ label: 'Woman', set: { gender: 'Female' } }, { label: 'Man', set: { gender: 'Male' } }, { label: 'Other', set: { gender: 'Other' } }] }))
      : null) ||
    (!n.monthlyIncome ? q('income', () => ({ key: 'income', text: 'Roughly how much does your family earn in a month?', number: true })) : null) ||
    (n.existingEmi === undefined ? q('emi', () => ({ key: 'emi', text: 'Do you already pay any loan EMIs? How much a month? Say 0 if none.', number: true })) : null) ||
    (n.purpose === 'quick' && n.hasGold === undefined
      ? q('gold', () => ({ key: 'gold', text: 'Do you have gold jewellery you could pledge? Gold loans are cheaper than personal loans.', options: [{ label: 'Yes', set: { hasGold: true } }, { label: 'No', set: { hasGold: false } }] }))
      : null)
  );
}

const merge = (a: LoanNeed, b: Partial<LoanNeed>): LoanNeed => {
  const out: LoanNeed = { ...a };
  for (const [k, v] of Object.entries(b)) if (v !== undefined && v !== null && v !== '') (out as any)[k] = k === 'roles' ? Array.from(new Set([...(a.roles || []), ...(v as any[])])) : v;
  return out;
};

/** Seed from the profile so we never ask what UDAAN ONE already knows. */
function fromProfile(p: BeneficiaryProfile): LoanNeed {
  const n: LoanNeed = {};
  if (p.gender === 'Female' || p.gender === 'Male') n.gender = p.gender;
  const cat = (p.socialCategory || '').match(/\b(SC|ST|OBC|General|EWS)\b/)?.[1] || (/Scheduled Caste/.test(p.socialCategory || '') ? 'SC' : '');
  if (cat) n.socialCategory = cat as LoanNeed['socialCategory'];
  const yearly = parseAmount(p.annualFamilyIncome || p.householdIncome || '');
  if (yearly && yearly > 12000) n.monthlyIncome = Math.round(yearly / 12);
  return n;
}

/** Answers for the loan's form, from what was said here (only fields the form has). */
function formValues(loanId: string, n: LoanNeed): Record<string, string> {
  const schema = FORM_SCHEMA_MAP[loanId];
  if (!schema) return {};
  const want: Record<string, string | undefined> = {
    loanAmount: n.amount ? String(n.amount) : undefined,
    tenureMonths: n.months ? String(n.months) : undefined,
    monthlyIncome: n.monthlyIncome ? String(n.monthlyIncome) : undefined,
    existingEmi: n.existingEmi !== undefined ? String(n.existingEmi) : undefined,
    loanPurpose: n.activity,
    proposedActivity: n.activity,
    businessActivity: n.activity,
    enterpriseActivity: n.activity,
    businessStatus: n.stage === 'new' ? 'New business' : n.stage === 'existing' ? 'Existing business' : undefined,
  };
  const out: Record<string, string> = {};
  for (const f of schema.fields) {
    const v = want[f.key];
    if (!v) continue;
    if (f.options && !f.options.includes(v)) continue;
    out[f.key] = v;
  }
  return out;
}

interface Turn {
  who: 'ai' | 'me';
  text: string;
}

const VERDICT = {
  fits: { tone: 'success' as const, label: 'Fits your budget' },
  tight: { tone: 'warning' as const, label: 'Tight — think twice' },
  heavy: { tone: 'danger' as const, label: 'Too heavy for your income' },
  unknown: { tone: 'neutral' as const, label: 'Add your income to check' },
};

const MatchCard: React.FC<{ m: LoanMatch; best: boolean; need: LoanNeed; onApply: Props['onApply']; onLearn: Props['onLearn']; onTool: Props['onTool'] }> = ({ m, best, need, onApply, onLearn, onTool }) => {
  const [open, setOpen] = useState(best);
  const months = need.months || m.loan.tenureMonths;
  const rate = rateFor(m.loan.id).rate;
  const fit = need.amount ? affordability(need.amount, rate, months, need.monthlyIncome, need.existingEmi || 0) : null;
  const bundle = skillBundleFor(m.loan.id, need.activity);
  const values = formValues(m.loan.id, need);
  return (
    <li className={`rounded-2xl border bg-white p-4 sm:p-5 ${best ? 'border-teal/50 ring-2 ring-teal/30' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {best && <StatusPill tone="success" icon={BadgeCheck}>Best for you</StatusPill>}
          <h3 className="mt-1.5 font-bold leading-snug text-navy">{m.loan.name}</h3>
          <p className="mt-0.5 text-sm font-semibold text-teal-600">{headline(m) || m.loan.summary}</p>
        </div>
        {fit && <StatusPill tone={VERDICT[fit.verdict].tone}>{VERDICT[fit.verdict].label}</StatusPill>}
      </div>

      {open && (
        <div className="mt-3 space-y-3 animate-fade-up">
          {m.reasons.length > 0 && (
            <ul className="space-y-1 text-sm text-navy">
              {m.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden /> <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {m.cautions.length > 0 && (
            <ul className="space-y-1 text-sm text-coral-600">
              {m.cautions.map((c) => (
                <li key={c} className="flex gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          {fit && need.amount && (
            <div className="rounded-xl bg-ivory p-3 text-sm">
              <p className="font-semibold text-navy">{`EMI about ${formatRupees(fit.emi)} a month for ${formatRupees(need.amount)} over ${months} months (at about ${rate}% a year).`}</p>
              {fit.verdict !== 'unknown' && <p className="mt-1 text-muted">{`A safe EMI for your income is up to ${formatRupees(fit.safeEmi)} a month.`}</p>}
              {(fit.verdict === 'tight' || fit.verdict === 'heavy') && (
                <p className="mt-1 font-semibold text-coral-600">
                  {fit.safeMonths ? `Repaying over ${fit.safeMonths} months would bring it within your budget.` : `A loan of about ${formatRupees(fit.safeAmount)} would fit your budget.`}
                </p>
              )}
            </div>
          )}
          <div className="rounded-xl border border-saffron/40 bg-saffron-50 p-3 text-sm">
            <p className="font-bold text-navy">{bundle.title}</p>
            <p className="mt-0.5 text-muted">{bundle.why}</p>
            {bundle.course && <p className="mt-1 text-xs font-semibold text-navy">{`${bundle.course.name} · ${bundle.course.duration}${bundle.course.stipend ? ' · stipend supported' : ''}`}</p>}
            <button onClick={() => onLearn(bundle.learnTopic)} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
              <BookOpen className="h-4 w-4" aria-hidden /> Start the free lessons
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onApply(m.loan.id, values, false)} className="btn btn-accent btn-sm h-10">
          <ScanLine className="h-4 w-4" aria-hidden /> Build my application
        </button>
        <button onClick={() => onApply(m.loan.id, values, true)} className="btn btn-success btn-sm h-10">
          <AudioLines className="h-4 w-4" aria-hidden /> By voice
        </button>
        <button onClick={() => onTool('bank', m.loan.id, need)} className="btn btn-ghost btn-sm h-10">
          <MapPin className="h-4 w-4" aria-hidden /> Nearest bank
        </button>
        {['business', 'micro', 'women', 'community', 'agriculture'].includes(m.loan.category) && (
          <button onClick={() => onTool('plan', m.loan.id, need)} className="btn btn-ghost btn-sm h-10">
            <FileText className="h-4 w-4" aria-hidden /> Business plan
          </button>
        )}
        {!best && (
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-ghost btn-sm h-10">
            {open ? 'Less' : 'Why this loan'} <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
};

/**
 * Loan by conversation: the person talks (or types / taps), the advisor asks only what it still
 * needs, then ranks the loans for them, checks the EMI against their income, and builds the
 * application with the answers already filled in.
 */
export const LoanAdvisor: React.FC<Props> = ({ profile, langConfig, onApply, onLearn, onTool }) => {
  const lang = langConfig.code;
  const seed = useMemo(() => fromProfile(profile), [profile]);
  const [need, setNeedState] = useState<LoanNeed>(seed);
  // The voice loop reads the latest answers between turns, so they also live in a ref
  const needRef = useRef(need);
  const setNeed = (n: LoanNeed) => {
    needRef.current = n;
    setNeedState(n);
  };
  const [asked, setAsked] = useState<Set<Key>>(new Set());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [talking, setTalking] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const voice = useVoiceTurns(langConfig.speechLocale);
  const talkingRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const question = nextQuestion(need, asked);
  const done = started && !question;
  const ranking = useMemo(() => (done ? rankLoans(need) : null), [done, need]);
  const top = ranking?.matches.slice(0, 3) || [];

  // Braces matter: newer browsers return a Promise from scrollIntoView, which React can't use as a cleanup
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns.length, done]);
  useEffect(() => () => voice.cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const askText = (q: Question) => q.text;

  /** Applies one answer (typed, spoken or tapped) and returns the updated need. */
  const answer = async (q: Question, text: string, set?: Partial<LoanNeed>): Promise<LoanNeed> => {
    setTurns((t) => [...t, { who: 'ai', text: askText(q) }, { who: 'me', text }]);
    setAsked((a) => new Set(a).add(q.key));
    let found: Partial<LoanNeed> = set || {};
    if (!set) {
      const amount = q.number ? parseAmount(text) : null;
      if (q.number && (amount !== null || /^(0|zero|none|no|nahi|नहीं|शून्य)$/i.test(text.trim()))) {
        found = q.key === 'amount' ? { amount: amount || undefined } : q.key === 'income' ? { monthlyIncome: amount || undefined } : { existingEmi: amount || 0 };
      } else {
        setBusy(true);
        found = await loanApi.understand(text, needRef.current, q.key).catch(() => ({}));
        setBusy(false);
      }
    }
    const next = merge(needRef.current, found);
    setNeed(next);
    return next;
  };

  const start = () => {
    setStarted(true);
    setTurns([]);
  };

  const reset = () => {
    voice.cancel();
    talkingRef.current = false;
    setTalking(false);
    setNeed(seed);
    setAsked(new Set());
    setTurns([]);
    setStarted(true);
  };

  /** Hands-free: speak each question, listen, repeat until a recommendation. */
  const talk = async () => {
    setStarted(true);
    talkingRef.current = true;
    setTalking(true);
    let n = needRef.current;
    let a = new Set(asked);
    for (let guard = 0; guard < 12 && talkingRef.current; guard++) {
      const q = nextQuestion(n, a);
      if (!q) break;
      const opts = q.options ? ` ${q.options.map((o) => o.label).join(', ')}.` : '';
      if (!(await voice.say(await spokenIn(lang, q.text + opts)))) return;
      const heard = await voice.listen(12000);
      if (heard === null || !talkingRef.current) return;
      a = new Set(a).add(q.key);
      if (!heard.trim()) {
        setAsked(a);
        continue;
      }
      n = await answer(q, heard);
    }
    if (!talkingRef.current) return;
    const best = rankLoans(n).matches[0];
    if (best) {
      const heard = await voice.say(await spokenIn(lang, `The best loan for you is ${best.loan.name}. ${headline(best)}. Say yes to build the application now.`)).then((ok) => (ok ? voice.listen(9000) : null));
      if (heard && /\b(yes|ok|okay|haan|ha|ji|sure|start)\b|हाँ|हां|जी|ठीक|சரி|ஆம்|అవును|సరే|ಹೌದು|ಸರಿ|അതെ|ശരി|হ্যাঁ|হাঁ|હા|ਹਾਂ|ହଁ|ہاں/i.test(heard)) onApply(best.loan.id, formValues(best.loan.id, n), true);
    }
    talkingRef.current = false;
    setTalking(false);
  };

  const stopTalking = () => {
    talkingRef.current = false;
    voice.cancel();
    setTalking(false);
  };

  const dictation = useDictation(langConfig.speechLocale, (heard) => question && answer(question, heard));

  if (!started) {
    return (
      <section className="surface-dark rounded-3xl p-6 sm:p-8" aria-labelledby="advisor-h">
        <p className="eyebrow text-teal">Loan advisor</p>
        <h2 id="advisor-h" className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Just tell us what you need — we find the loan</h2>
        <p className="mt-2 max-w-2xl text-slate-300">You don’t need to know any scheme names. Talk or type; we ask a few questions, pick the best loan for you, check the EMI fits your income, and fill the application.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={talk} className="btn btn-accent h-12 px-5">
            <Mic className="h-5 w-5" aria-hidden /> Talk to the advisor
          </button>
          <button onClick={start} className="btn btn-on-dark h-12 px-5">
            <MessageCircle className="h-5 w-5" aria-hidden /> Type or tap instead
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="advisor-h">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-ivory px-5 py-3">
        <h2 id="advisor-h" className="flex items-center gap-2 font-bold text-navy">
          <Sparkles className="h-5 w-5 text-saffron" aria-hidden /> Loan advisor
        </h2>
        <div className="flex gap-2">
          {talking ? (
            <button onClick={stopTalking} className="btn btn-outline btn-sm">
              <Square className="h-4 w-4" aria-hidden /> Stop voice
            </button>
          ) : (
            <button onClick={talk} className="btn btn-outline btn-sm">
              <Mic className="h-4 w-4" aria-hidden /> Talk
            </button>
          )}
          <button onClick={reset} className="btn btn-ghost btn-sm">
            <RotateCcw className="h-4 w-4" aria-hidden /> Start over
          </button>
        </div>
      </div>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto p-5" aria-live="polite">
        {turns.map((t, i) => (
          <p key={i} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${t.who === 'ai' ? 'bg-ivory text-navy' : 'ml-auto bg-navy text-white'}`} translate={t.who === 'me' ? 'no' : undefined}>
            {t.text}
          </p>
        ))}
        {question && (
          <div className="max-w-[85%] rounded-2xl bg-teal-50 px-4 py-3 text-navy">
            <p className="font-semibold">{askText(question)}</p>
            {talking && <p className="mt-1 text-xs text-muted">{voice.phase === 'listening' ? voice.interim || 'Listening…' : voice.phase === 'speaking' ? 'Speaking…' : ''}</p>}
            {question.options && (
              <div className="mt-2 flex flex-wrap gap-2">
                {question.options.map((o) => (
                  <button key={o.label} disabled={busy || talking} onClick={() => answer(question, o.label, o.set)} className="h-9 rounded-full border border-line bg-white px-3 text-sm font-semibold text-navy hover:border-navy-700/40 disabled:opacity-50">
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {busy && <Spinner className="h-5 w-5" label="Understanding" />}
        {done && ranking && (
          <div className="space-y-3 pt-2 animate-fade-up">
            <p className="text-sm font-semibold text-navy">
              {top.length ? 'Here are the loans that fit you best, ranked for you. Rates are indicative — the lender decides.' : 'No loan fits all of that yet. Try changing the amount or what the loan is for.'}
            </p>
            <ul className="space-y-3">
              {top.map((m, i) => (
                <MatchCard key={m.loan.id} m={m} best={i === 0} need={need} onApply={onApply} onLearn={onLearn} onTool={onTool} />
              ))}
            </ul>
            {ranking.excluded.length > 0 && (
              <div className="text-sm">
                <button onClick={() => setShowExcluded((s) => !s)} aria-expanded={showExcluded} className="font-semibold text-teal-600 hover:underline">
                  {showExcluded ? 'Hide' : 'Why not the other loans?'}
                </button>
                {showExcluded && (
                  <ul className="mt-2 space-y-1 text-muted">
                    {ranking.excluded.filter((x) => x.why !== 'Made for a different need').map((x) => (
                      <li key={x.loan.id}>{`${x.loan.name}: ${x.why}`}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <p className="flex items-start gap-2 rounded-xl bg-coral-50 p-3 text-sm text-navy">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral-600" aria-hidden />
              <span>Government loans have no agents and no fees to apply. If anyone asks you to pay to get a loan, it is a scam.</span>
            </p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {question && !talking && (
        <form
          className="flex gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            const text = input;
            setInput('');
            answer(question, text);
          }}
        >
          <label htmlFor="advisor-input" className="sr-only">Your answer</label>
          <input id="advisor-input" value={input} onChange={(e) => setInput(e.target.value)} inputMode={question.number ? 'numeric' : undefined} placeholder={question.number ? 'e.g. 50000 or 2 lakh' : 'Type your answer'} className="field h-11 flex-1" />
          {dictation.supported && (
            <button type="button" onClick={dictation.listening ? dictation.stop : dictation.start} className={`btn h-11 w-11 p-0 ${dictation.listening ? 'bg-coral text-white' : 'btn-primary'}`} aria-label={dictation.listening ? 'Stop listening' : 'Answer by voice'}>
              {dictation.listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
            </button>
          )}
          <button className="btn btn-accent h-11 px-4" disabled={busy || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={() => answer(question, 'Skip', {})} className="btn btn-ghost h-11 px-3 text-sm">
            Skip
          </button>
        </form>
      )}
    </section>
  );
};
