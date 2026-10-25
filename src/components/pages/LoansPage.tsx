import React, { useMemo, useState } from 'react';
import { AlertTriangle, AudioLines, BadgePercent, ChevronDown, Compass, ExternalLink, IndianRupee, Landmark, Mic, MicOff, ScanLine, Search, ShieldCheck, Sparkles } from 'lucide-react';
import type { BeneficiaryProfile, ChannelMode, Language } from '../../types';
import { LENDER_TYPE_LABEL, LOAN_CATEGORIES, LOAN_LISTINGS, emi, formatRupees, type LoanCategory, type LoanListing } from '../../data/loanCatalog';
import { FORM_SCHEMA_MAP } from '../../data/autofillSchema';
import { estimateEligibility } from '../../data/schemeCatalog';
import { autofillApi, type SchemeInfo } from '../../services/autofillApi';
import { useDictation } from '../smartapply/media';
import { Alert, EmptyState, Spinner, StatusPill } from '../ui/kit';
import { ExploreTabs } from './DocumentsPage';
import { LoanAdvisor, type LoanTool } from '../loans/LoanAdvisor';
import { LoanTools } from '../loans/LoanTools';
import type { LoanNeed } from '../../data/loanAdvice';

interface Props {
  profile: BeneficiaryProfile;
  langConfig: Language;
  /** Open Smart Apply for this loan; `byVoice` fills it by voice from the start. */
  onApply: (id: string, byVoice?: boolean) => void;
  /** Start an application with answers the advisor already collected. */
  onApplyWith: (id: string, values: Record<string, string>, byVoice: boolean) => void;
  onLearn: (topic: string) => void;
  onNavigate: (m: ChannelMode) => void;
}

type Backing = 'all' | 'government' | 'market';

const TENURES = [6, 12, 24, 36, 60, 120, 240];

function quickMatch(l: LoanListing, q: string) {
  if (!q.trim()) return true;
  const hay = `${l.name} ${l.summary} ${l.ministry} ${l.offers.map((o) => o.lender).join(' ')} ${(FORM_SCHEMA_MAP[l.id]?.keywords || []).join(' ')}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/^(loan|loans|want|need|money|with|from|that|this|have|some)$/.test(w))
    .some((w) => hay.includes(w));
}

const LoanCard: React.FC<{
  l: LoanListing;
  profile: BeneficiaryProfile;
  amount: number;
  months: number;
  highlight: boolean;
  onApply: (id: string, byVoice?: boolean) => void;
}> = ({ l, profile, amount, months, highlight, onApply }) => {
  const [open, setOpen] = useState(highlight);
  const est = estimateEligibility(l, profile);
  const tooBig = amount > 0 && l.amount.max !== undefined && amount > l.amount.max;
  const term = months || l.tenureMonths;
  const cheapest = Math.min(...l.offers.map((o) => o.rateFrom ?? l.estimateRate));
  // A per-lender EMI only says something when at least one lender publishes a rate
  const lenderEmi = amount > 0 && l.offers.some((o) => o.rateFrom);
  return (
    <li id={`card-${l.id}`} className={`card flex flex-col p-5 sm:p-6 ${highlight ? 'ring-2 ring-teal/50' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">{l.ministry}</p>
          <h2 className="mt-1 text-lg font-bold leading-snug text-navy">{l.name}</h2>
        </div>
        {l.backing === 'government' ? (
          <StatusPill tone="success" icon={ShieldCheck}>Government-backed</StatusPill>
        ) : (
          <StatusPill tone="info" icon={Landmark}>Bank / NBFC</StatusPill>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{l.summary}</p>

      {l.statusNote && (
        <p className="mt-3 flex gap-2 rounded-xl bg-saffron-50 p-3 text-xs font-semibold text-saffron-600">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {l.statusNote}
        </p>
      )}

      <dl className="mt-4 grid gap-3 rounded-xl bg-ivory p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">How much</dt>
          <dd className="mt-0.5 text-navy">{l.amount.text}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Interest</dt>
          <dd className="mt-0.5 text-navy">{l.rate}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Collateral</dt>
          <dd className="mt-0.5 text-navy">{l.collateral}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Repay over</dt>
          <dd className="mt-0.5 text-navy">{l.tenure}</dd>
        </div>
        {l.subsidy && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-bold uppercase tracking-wider text-green">Government help</dt>
            <dd className="mt-0.5 font-semibold text-green">{l.subsidy}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Who can apply</p>
        <p className="mt-1 text-navy">{l.eligibilitySummary}</p>
        {est.level === 'unlikely' && <p className="mt-1 text-xs font-semibold text-coral-600">{est.reasons.join(' · ')}</p>}
        {tooBig && <p className="mt-1 text-xs font-semibold text-coral-600">{`${formatRupees(amount)} is above this loan’s limit of ${formatRupees(l.amount.max!)}.`}</p>}
      </div>

      {amount > 0 && !tooBig && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-teal/30 bg-teal-50 px-3 py-2 text-sm text-navy">
          <BadgePercent className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          <span className="font-semibold">{`Estimated EMI from ${formatRupees(emi(amount, cheapest, term))} a month for ${formatRupees(amount)} over ${term} months`}</span>
        </p>
      )}

      {open && (
        <div className="mt-4 border-t border-line pt-4 animate-fade-up">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Where to get it — compare lenders</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1.5 pr-3 font-semibold">Lender</th>
                  <th className="py-1.5 pr-3 font-semibold">Type</th>
                  <th className="py-1.5 pr-3 font-semibold">Indicative interest</th>
                  {lenderEmi && <th className="py-1.5 font-semibold">EMI*</th>}
                </tr>
              </thead>
              <tbody>
                {l.offers.map((o) => (
                  <tr key={o.lender} className="border-t border-line align-top">
                    <td className="py-2 pr-3">
                      <a href={o.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-600 hover:underline">
                        {o.lender}
                      </a>
                      {o.note && <span className="block text-xs text-muted">{o.note}</span>}
                    </td>
                    <td className="py-2 pr-3 text-muted">{LENDER_TYPE_LABEL[o.type]}</td>
                    <td className="py-2 pr-3 text-navy">{o.rate}</td>
                    {lenderEmi && <td className="py-2 text-navy">{formatRupees(emi(amount, o.rateFrom ?? l.estimateRate, term))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            {lenderEmi && <span className="block">{`*EMI uses each lender’s lowest published rate, or a typical ${l.estimateRate}% where none is published.`}</span>}
            <span className="block">{`Rates checked ${l.checked}; your rate depends on your credit score and the lender’s Key Fact Statement.`}</span>
          </p>
          <ol className="mt-4 space-y-2">
            {l.steps.map((step, i) => (
              <li key={step} className="flex gap-2.5 text-sm text-navy">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button onClick={() => onApply(l.id)} className="btn btn-accent btn-sm h-10">
          <ScanLine className="h-4 w-4" aria-hidden /> Prepare application
        </button>
        <button onClick={() => onApply(l.id, true)} className="btn btn-success btn-sm h-10">
          <AudioLines className="h-4 w-4" aria-hidden /> By voice
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-ghost btn-sm h-10">
          {open ? 'Hide lenders' : `Compare ${l.offers.length} lender${l.offers.length === 1 ? '' : 's'}`} <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <a href={l.officialUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
          {l.officialLabel} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </li>
  );
};

export const LoansPage: React.FC<Props> = ({ profile, langConfig, onApply, onApplyWith, onLearn, onNavigate }) => {
  const [tool, setTool] = useState<LoanTool>('budget');
  const [toolLoan, setToolLoan] = useState<string | undefined>();
  const [toolNeed, setToolNeed] = useState<LoanNeed | undefined>();
  const openTool = (t: LoanTool, loanId?: string, need?: LoanNeed) => {
    setTool(t);
    if (loanId) setToolLoan(loanId);
    if (need) setToolNeed(need);
    requestAnimationFrame(() => document.getElementById('loan-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LoanCategory | 'all'>('all');
  const [backing, setBacking] = useState<Backing>('all');
  const [amountText, setAmountText] = useState('');
  const [months, setMonths] = useState(0);
  const [searching, setSearching] = useState(false);
  const [aiResult, setAiResult] = useState<{ scheme: SchemeInfo | null; reason: string; related: SchemeInfo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountText.replace(/[^0-9]/g, '')) || 0;
  const isLoan = (id?: string) => Boolean(id && LOAN_LISTINGS.some((l) => l.id === id));
  const highlighted = isLoan(aiResult?.scheme?.schemeId) ? aiResult!.scheme!.schemeId : null;
  const relatedLoans = (aiResult?.related || []).filter((r) => isLoan(r.schemeId)).map((r) => r.schemeId);

  const ordered = useMemo(() => {
    const shown = LOAN_LISTINGS.filter(
      (l) =>
        (category === 'all' || l.category === category) &&
        (backing === 'all' || l.backing === backing) &&
        // An AI match shows just the matching loans; otherwise filter by the typed words
        (highlighted ? l.id === highlighted || relatedLoans.includes(l.id) : quickMatch(l, query))
    );
    // Best match first, then government-backed loans, then the cheapest
    const rank = (l: LoanListing) => (l.id === highlighted ? -100 : relatedLoans.includes(l.id) ? -50 : 0) + (l.backing === 'government' ? 0 : 20) + l.estimateRate;
    return [...shown].sort((a, b) => rank(a) - rank(b));
  }, [category, backing, query, highlighted, relatedLoans.join()]);

  const aiSearch = async (text = query) => {
    if (!text.trim()) return;
    setSearching(true);
    setError(null);
    setAiResult(null);
    try {
      const r = await autofillApi.intent(/loan|लोन|ऋण/i.test(text) ? text : `${text} (loan)`, langConfig.name);
      setAiResult({ scheme: r.scheme, reason: r.reason, related: r.relatedSchemes || [] });
      setCategory('all');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const dictation = useDictation(langConfig.speechLocale, (heard) => {
    setQuery(heard);
    aiSearch(heard);
  });

  const governmentCount = LOAN_LISTINGS.filter((l) => l.backing === 'government').length;

  return (
    <div className="space-y-8">
      <ExploreTabs current="loans" onNavigate={onNavigate} />
      <header className="max-w-3xl">
        <p className="eyebrow">Loans</p>
        <h1 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">Find the right loan, from the right lender</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          {`Tell us what the money is for. We compare ${governmentCount} government loan schemes with bank, NBFC and microfinance loans, estimate your EMI, and fill the application — by typing, from your documents, or by voice.`}
        </p>
      </header>

      <LoanAdvisor profile={profile} langConfig={langConfig} onApply={onApplyWith} onLearn={onLearn} onTool={openTool} />

      <LoanTools profile={profile} langConfig={langConfig} tool={tool} onTool={setTool} loanId={toolLoan} need={toolNeed} />

      <h2 className="pt-2 text-xl font-extrabold text-navy">Browse all loans</h2>
      <div className="card space-y-4 p-4 sm:p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            aiSearch();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <label htmlFor="loan-search" className="sr-only">Describe what you need the loan for</label>
            <input
              id="loan-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAiResult(null);
              }}
              placeholder='Try "money to buy two buffaloes" or "loan for my daughter’s engineering fees"'
              className="field h-14 rounded-2xl bg-ivory pl-12 text-base focus:bg-white"
            />
          </div>
          <div className="flex gap-2">
            {dictation.supported && (
              <button
                type="button"
                onClick={dictation.listening ? dictation.stop : dictation.start}
                className={`btn h-14 w-14 p-0 ${dictation.listening ? 'bg-coral text-white' : 'btn-primary'}`}
                aria-label={dictation.listening ? 'Stop listening' : 'Search by voice'}
              >
                {dictation.listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
              </button>
            )}
            <button className="btn btn-accent h-14 flex-1 px-5 sm:flex-none" disabled={searching || !query.trim()}>
              {searching ? <Spinner className="h-5 w-5" /> : <Sparkles className="h-5 w-5" aria-hidden />} Find my loan
            </button>
          </div>
        </form>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Amount you need (₹)</span>
            <div className="relative mt-1">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                inputMode="numeric"
                value={amount ? amount.toLocaleString('en-IN') : amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="e.g. 2,00,000"
                className="field h-12 pl-9"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Repay over</span>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="field mt-1 h-12">
              <option value={0}>Typical for each loan</option>
              {TENURES.map((m) => (
                <option key={m} value={m}>
                  {m < 12 ? `${m} months` : `${m / 12} year${m === 12 ? '' : 's'} (${m} months)`}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex rounded-xl border border-line bg-white p-1" role="group" aria-label="Who lends">
            {(
              [
                ['all', 'All'],
                ['government', 'Government'],
                ['market', 'Banks & NBFCs'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setBacking(id)}
                aria-pressed={backing === id}
                className={`h-10 rounded-lg px-3 text-sm font-semibold transition ${backing === id ? 'bg-navy text-white' : 'text-muted hover:text-navy'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="What is the loan for">
          {[{ id: 'all' as const, label: 'All needs', hint: '' }, ...LOAN_CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              title={c.hint}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${category === c.id ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy-700/40'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert tone="danger" title={error} />}
      {aiResult && (
        <div aria-live="polite" className="animate-fade-up">
          {highlighted ? (
            <Alert tone="success" title={`Best match: ${aiResult.scheme!.name}`}>
              <span className="block">{aiResult.reason || 'Matched from what you described.'}</span>
              <span className="block">{relatedLoans.length ? 'Shown below with other loans that may also fit.' : 'Shown below.'}</span>
              <button
                onClick={() => {
                  setAiResult(null);
                  setQuery('');
                }}
                className="mt-2 block text-sm font-semibold text-teal-600 hover:underline"
              >
                {`Show all ${LOAN_LISTINGS.length} loans`}
              </button>
            </Alert>
          ) : aiResult.scheme ? (
            <Alert
              tone="info"
              title={`That sounds like: ${aiResult.scheme.name}`}
              action={
                <button onClick={() => onApply(aiResult.scheme!.schemeId)} className="btn btn-primary btn-sm">
                  Prepare application
                </button>
              }
            >
              {aiResult.reason}
            </Alert>
          ) : (
            <Alert tone="neutral" title="No exact match yet">
              Pick what the loan is for above, or describe it in a few more words — for example “loan for a tailoring shop”.
            </Alert>
          )}
        </div>
      )}

      <Alert tone="warning" title="Borrow safely">
        Choose a government-backed loan first when you qualify — they are cheaper. Borrow only from RBI-registered lenders (check on sachet.rbi.org.in), never pay a fee to get a loan approved, and keep all your EMIs well under half of your monthly income.
      </Alert>

      <p className="flex items-center gap-2 text-sm text-muted">
        <Compass className="h-4 w-4" aria-hidden /> <span>{`${ordered.length} ${ordered.length === 1 ? 'loan' : 'loans'} · rates are indicative (checked October 2026); the lender decides.`}</span>
      </p>

      {ordered.length === 0 ? (
        <EmptyState icon={Search} title="No loans match that search" body='Try simpler words like "business", "farm", "education" or "gold", or use Find my loan.' />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {ordered.map((l) => (
            <LoanCard key={l.id} l={l} profile={profile} amount={amount} months={months} highlight={l.id === highlighted} onApply={onApply} />
          ))}
        </ul>
      )}
    </div>
  );
};
