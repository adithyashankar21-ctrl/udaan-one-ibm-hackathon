import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Calculator, Download, ExternalLink, FileSearch, FileText, LocateFixed, MapPin, Mic, MicOff, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import type { BeneficiaryProfile, Language } from '../../types';
import { LOAN_LISTINGS, formatRupees, rateFor } from '../../data/loanCatalog';
import { FRAUD_BASICS, OFFICIAL_HELP, affordability, fraudFlags, parseAmount, visitGuideFor, type LoanNeed } from '../../data/loanAdvice';
import { loanApi, type BusinessPlan, type ContractReview, type FraudReview, type NearbyPlace } from '../../services/loanApi';
import { prepareFile, useDictation } from '../smartapply/media';
import { Alert, Spinner, StatusPill, UploadZone } from '../ui/kit';
import type { LoanTool } from './LoanAdvisor';

interface Props {
  profile: BeneficiaryProfile;
  langConfig: Language;
  tool: LoanTool;
  onTool: (t: LoanTool) => void;
  loanId?: string;
  need?: LoanNeed;
}

const TABS: Array<{ id: LoanTool; label: string; icon: React.ElementType }> = [
  { id: 'budget', label: 'Can I afford it?', icon: Calculator },
  { id: 'plan', label: 'Business plan', icon: FileText },
  { id: 'contract', label: 'Check loan papers', icon: FileSearch },
  { id: 'fraud', label: 'Fraud shield', icon: ShieldAlert },
  { id: 'bank', label: 'Nearest bank', icon: MapPin },
];

const money = (s: string) => parseAmount(s) || 0;

/* ── Repayment reality check ─────────────────────────────────────── */
const Budget: React.FC<{ loanId?: string; need?: LoanNeed; profile: BeneficiaryProfile }> = ({ loanId, need, profile }) => {
  const [loan, setLoan] = useState(loanId || 'mudra');
  const [income, setIncome] = useState(need?.monthlyIncome ? String(need.monthlyIncome) : '');
  const [emis, setEmis] = useState(need?.existingEmi ? String(need.existingEmi) : '');
  const [amount, setAmount] = useState(need?.amount ? String(need.amount) : '');
  const listing = LOAN_LISTINGS.find((l) => l.id === loan) || LOAN_LISTINGS[0];
  const [months, setMonths] = useState(need?.months || listing.tenureMonths);
  const [rate, setRate] = useState(rateFor(loan).rate);
  useEffect(() => {
    setRate(rateFor(loan).rate);
    setMonths(need?.months || listing.tenureMonths);
  }, [loan]); // eslint-disable-line react-hooks/exhaustive-deps
  void profile;
  const a = money(amount) ? affordability(money(amount), rate, months, money(income) || undefined, money(emis)) : null;
  const pct = a && a.maxEmi ? Math.min(100, Math.round((a.emi / (money(income) * 0.5)) * 100)) : 0;
  const tone = a?.verdict === 'fits' ? 'bg-green' : a?.verdict === 'tight' ? 'bg-saffron' : 'bg-coral';

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Loan</span>
          <select value={loan} onChange={(e) => setLoan(e.target.value)} className="field mt-1 h-11">
            {LOAN_LISTINGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ['Family income per month (₹)', income, setIncome],
            ['EMIs you already pay per month (₹)', emis, setEmis],
            ['Loan amount (₹)', amount, setAmount],
          ] as const
        ).map(([label, v, set]) => (
          <label key={label} className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
            <input value={v} onChange={(e) => set(e.target.value)} inputMode="numeric" className="field mt-1 h-11" />
          </label>
        ))}
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Repay over (months)</span>
          <input type="number" min={3} max={360} value={months} onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))} className="field mt-1 h-11" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Interest a year (%)</span>
          <input type="number" step="0.1" min={0} max={60} value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} className="field mt-1 h-11" />
        </label>
      </div>

      <div className="rounded-2xl bg-ivory p-5">
        {!a ? (
          <p className="text-sm text-muted">Enter the loan amount and your income to see whether the EMI is safe for you.</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted">Your EMI</p>
            <p className="text-3xl font-extrabold text-navy">{`${formatRupees(a.emi)} / month`}</p>
            {a.verdict === 'unknown' ? (
              <p className="mt-2 text-sm text-muted">Add your monthly income to check if this fits your budget.</p>
            ) : (
              <>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white" role="img" aria-label={`${pct}% of the most you should pay`}>
                  <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`mt-3 text-lg font-bold ${a.verdict === 'fits' ? 'text-green' : a.verdict === 'tight' ? 'text-saffron-600' : 'text-coral-600'}`}>
                  {a.verdict === 'fits' ? 'This loan fits your budget' : a.verdict === 'tight' ? 'This is tight — you may struggle in a bad month' : 'This is too heavy — it can trap you in debt'}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-navy">
                  <li>{`Safe EMI for your income: up to ${formatRupees(a.safeEmi)} a month (40% of income, minus EMIs you already pay).`}</li>
                  <li>{`Never go above ${formatRupees(a.maxEmi)} a month in total EMIs (half your income).`}</li>
                  {a.verdict !== 'fits' && <li className="font-semibold">{`A loan of about ${formatRupees(a.safeAmount)} over ${months} months would fit.`}</li>}
                  {a.verdict !== 'fits' && a.safeMonths && <li className="font-semibold">{`Or repay ${formatRupees(money(amount))} over ${a.safeMonths} months.`}</li>}
                  <li className="text-muted">{`You would pay back about ${formatRupees(a.emi * months)} in total — ${formatRupees(a.emi * months - money(amount))} of it is interest.`}</li>
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ── Business plan builder ───────────────────────────────────────── */
const Plan: React.FC<{ langConfig: Language; need?: LoanNeed; profile: BeneficiaryProfile }> = ({ langConfig, need, profile }) => {
  const [text, setText] = useState(need?.activity ? `I want to ${need.activity}${need.amount ? `, and I need about ₹${need.amount.toLocaleString('en-IN')}` : ''}.` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: BusinessPlan; local: BusinessPlan | null } | null>(null);
  const dictation = useDictation(langConfig.speechLocale, (heard) => setText((t) => (t ? `${t} ${heard}` : heard)));
  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await loanApi.businessPlan(text, need || {}, langConfig.name));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!result) return;
    const blob = await loanApi.businessPlanPdf(result.plan, profile.name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'UDAAN-ONE-business-plan.pdf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const shown = result?.local || result?.plan;
  const total = (rows: BusinessPlan['setupCosts']) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Describe your business idea out loud or in writing — what you will sell, to whom, where, what you need to buy, and roughly what it costs. We turn it into a one-page plan the bank can read.</p>
      <div className="flex gap-2">
        <label htmlFor="plan-text" className="sr-only">Describe your business</label>
        <textarea id="plan-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="e.g. I stitch blouses at home. I want to open a small tailoring shop in my village market with 2 machines…" className="field min-h-28 flex-1 py-3" />
        {dictation.supported && (
          <button type="button" onClick={dictation.listening ? dictation.stop : dictation.start} className={`btn h-12 w-12 shrink-0 p-0 ${dictation.listening ? 'bg-coral text-white' : 'btn-primary'}`} aria-label={dictation.listening ? 'Stop listening' : 'Describe by voice'}>
            {dictation.listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
          </button>
        )}
      </div>
      <button onClick={build} disabled={busy || text.trim().split(/\s+/).length < 4} className="btn btn-accent h-11">
        {busy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" aria-hidden />} Build my business plan
      </button>
      {error && <Alert tone="danger" title={error} />}
      {shown && (
        <article className="rounded-2xl border border-line bg-white p-5 animate-fade-up">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-navy" translate="no">{shown.title}</h3>
            <button onClick={download} className="btn btn-primary btn-sm">
              <Download className="h-4 w-4" aria-hidden /> Download PDF for the bank
            </button>
          </div>
          <p className="mt-2 text-sm text-navy" translate="no">{shown.summary}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ['One-time setup costs', shown.setupCosts],
                ['Monthly running costs', shown.monthlyCosts],
              ] as const
            ).map(([label, rows]) => (
              <div key={label}>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-navy">
                  {rows.map((c) => (
                    <li key={c.item} className="flex justify-between gap-3">
                      <span translate="no">{c.item}</span>
                      <span>{formatRupees(c.amount)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-3 border-t border-line pt-1 font-bold">
                    <span>Total</span>
                    <span>{formatRupees(total(rows))}</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>
          <dl className="mt-4 grid gap-2 rounded-xl bg-ivory p-3 text-sm sm:grid-cols-3">
            {(
              [
                ['Expected sales a month', shown.monthlySales],
                ['Profit a month before EMI', shown.monthlySales - total(shown.monthlyCosts)],
                ['Loan needed', shown.loanNeeded],
              ] as const
            ).map(([label, v]) => (
              <div key={label}>
                <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
                <dd className="font-bold text-navy">{formatRupees(v)}</dd>
              </div>
            ))}
          </dl>
          <div translate="no">
            <p className="mt-3 text-sm text-navy">{shown.repayment}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-navy">
              {shown.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          {shown.assumptions.length > 0 && (
            <div className="mt-3 rounded-xl bg-saffron-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Estimates — please check and correct</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-navy" translate="no">
                {shown.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {result?.local && <p className="mt-3 text-xs text-muted">The PDF is in English so the bank can read it.</p>}
        </article>
      )}
    </div>
  );
};

/* ── Plain-language contract check ───────────────────────────────── */
const FLAG = { ok: { tone: 'success' as const, label: 'Normal' }, watch: { tone: 'warning' as const, label: 'Watch' }, danger: { tone: 'danger' as const, label: 'Danger' } };
const Contract: React.FC<{ langConfig: Language }> = ({ langConfig }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ContractReview | null>(null);
  const check = async () => {
    setBusy(true);
    setError(null);
    setReview(null);
    try {
      const uploads = await Promise.all(files.map(prepareFile));
      setReview(await loanApi.contract({ text, files: uploads }, langConfig.name));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Before you sign, upload the loan agreement, sanction letter or Key Fact Statement (or paste its text). We explain it in simple words and warn you about anything unusual — high fees, penalties, hidden insurance.</p>
      <UploadZone onFiles={(f) => setFiles(f.slice(0, 8))} accept="application/pdf,image/*" title="Upload the loan papers" hint="PDF or photos of each page" />
      {files.length > 0 && <p className="text-sm text-navy" translate="no">{files.map((f) => f.name).join(', ')}</p>}
      <label htmlFor="contract-text" className="sr-only">Or paste the loan terms</label>
      <textarea id="contract-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Or paste the terms here" className="field min-h-20 py-3" />
      <button onClick={check} disabled={busy || (!text.trim() && !files.length)} className="btn btn-accent h-11">
        {busy ? <Spinner className="h-4 w-4" /> : <FileSearch className="h-4 w-4" aria-hidden />} Explain these terms
      </button>
      {error && <Alert tone="danger" title={error} />}
      {review && (
        <div className="space-y-3 animate-fade-up">
          <div translate="no">
            <Alert tone={review.verdict === 'ok' ? 'success' : review.verdict === 'careful' ? 'warning' : 'danger'} title={review.verdictReason} />
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-navy" translate="no">
            {review.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <ul className="space-y-2">
            {review.terms.map((t) => (
              <li key={t.label + t.value} className={`rounded-xl border p-3 ${t.flag === 'danger' ? 'border-coral/40 bg-coral-50' : t.flag === 'watch' ? 'border-saffron/40 bg-saffron-50' : 'border-line bg-white'}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy">
                  <StatusPill tone={FLAG[t.flag].tone}>{FLAG[t.flag].label}</StatusPill>
                  <span translate="no">{`${t.label}: ${t.value}`}</span>
                </p>
                <p className="mt-1 text-sm text-muted" translate="no">{t.plain}</p>
              </li>
            ))}
          </ul>
          {!!review.missing?.length && (
            <ul className="list-disc space-y-0.5 rounded-xl bg-ivory p-3 pl-8 text-sm text-navy" translate="no">
              {review.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          {!!review.questions?.length && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm font-semibold text-navy" translate="no">
              {review.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Fraud shield ────────────────────────────────────────────────── */
const Fraud: React.FC<{ langConfig: Language }> = ({ langConfig }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<(FraudReview & { rules?: unknown }) | null>(null);
  const flags = useMemo(() => (text.trim().length > 8 ? fraudFlags(text) : []), [text]);
  const check = async () => {
    setBusy(true);
    try {
      setReview(await loanApi.fraudCheck(text, langConfig.name));
    } catch {
      setReview(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm text-muted">Got a loan offer by SMS, WhatsApp, a call or an app? Paste it here and we check it for scam signs.</p>
        <label htmlFor="fraud-text" className="sr-only">Paste the message</label>
        <textarea
          id="fraud-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReview(null);
          }}
          rows={4}
          placeholder="e.g. Congratulations! Your ₹2 lakh loan is approved. Pay ₹1,999 processing fee to this UPI ID to release it…"
          className="field min-h-28 py-3"
        />
        {flags.length > 0 && (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.title} className={`rounded-xl border p-3 text-sm ${f.level === 'danger' ? 'border-coral/40 bg-coral-50' : 'border-saffron/40 bg-saffron-50'}`}>
                <p className="font-bold text-navy">{f.title}</p>
                <p className="text-muted">{f.advice}</p>
              </li>
            ))}
          </ul>
        )}
        <button onClick={check} disabled={busy || text.trim().length < 8} className="btn btn-accent h-11">
          {busy ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" aria-hidden />} Check this offer
        </button>
        {review && (
          <div className="space-y-2 animate-fade-up">
            <Alert tone={review.verdict === 'scam' ? 'danger' : review.verdict === 'suspicious' || review.verdict === 'unknown' ? 'warning' : 'success'} title={review.verdict === 'scam' ? 'This looks like a scam' : review.verdict === 'suspicious' ? 'This looks suspicious' : review.verdict === 'unknown' ? 'Could not be sure — follow the safe steps' : 'No common scam signs found — still verify the lender'} />
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-navy" translate="no">
              {[...review.reasons, ...review.whatToDo].map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {FRAUD_BASICS.map((f) => (
          <div key={f.title} className="flex gap-3 rounded-xl bg-ivory p-3">
            {f.level === 'danger' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-coral-600" aria-hidden /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden />}
            <div>
              <p className="text-sm font-bold text-navy">{f.title}</p>
              <p className="text-sm text-muted">{f.advice}</p>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {OFFICIAL_HELP.map((h) => (
            <a key={h.url} href={h.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              {h.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Nearest bank guide ──────────────────────────────────────────── */
const Bank: React.FC<{ loanId?: string; profile: BeneficiaryProfile; lang: string }> = ({ loanId, profile, lang }) => {
  const [loan, setLoan] = useState(loanId || 'mudra');
  const listing = LOAN_LISTINGS.find((l) => l.id === loan) || LOAN_LISTINGS[0];
  const lenders = listing.offers.map((o) => o.lender);
  const [lender, setLender] = useState(lenders[0]);
  useEffect(() => setLender(LOAN_LISTINGS.find((l) => l.id === loan)?.offers[0]?.lender || ''), [loan]);
  const [pincode, setPincode] = useState(profile.pincode || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const guide = visitGuideFor(listing, lender);
  const office = guide.searchFor === 'District Social Welfare Office';
  const brand = office ? '' : guide.searchFor === 'bank' ? '' : guide.searchFor.split(' (')[0].replace(/\bBank\b/i, '').trim() || guide.searchFor;

  const find = async (where: { lat: number; lon: number } | { pincode: string }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await loanApi.nearby(where, brand, office ? 'office' : 'bank', lang);
      setPlaces(r.places);
    } catch (e: any) {
      setError(e.message);
      setPlaces(null);
    } finally {
      setBusy(false);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) return setError('Location is not available on this device. Enter your PIN code instead.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => find({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {
        setBusy(false);
        setError('Location was not shared. Enter your PIN code instead.');
      },
      { timeout: 10000 }
    );
  };
  const mapSearch = `https://www.google.com/maps/search/${encodeURIComponent(`${guide.searchFor} near ${pincode || 'me'}`)}`;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Loan</span>
            <select value={loan} onChange={(e) => setLoan(e.target.value)} className="field mt-1 h-11">
              {LOAN_LISTINGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Lender</span>
            <select value={lender} onChange={(e) => setLender(e.target.value)} className="field mt-1 h-11">
              {lenders.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={locate} disabled={busy} className="btn btn-primary h-11">
            <LocateFixed className="h-4 w-4" aria-hidden /> Use my location
          </button>
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{6}$/.test(pincode)) find({ pincode });
            }}
          >
            <label htmlFor="bank-pin" className="sr-only">PIN code</label>
            <input id="bank-pin" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="PIN code" className="field h-11 w-32" />
            <button className="btn btn-outline h-11" disabled={busy || !/^\d{6}$/.test(pincode)}>
              Search
            </button>
          </form>
        </div>
        <p className="text-xs text-muted">Your location is used only for this search (OpenStreetMap) and is not saved.</p>
        {busy && <Spinner className="h-5 w-5" label="Searching" />}
        {error && <Alert tone="warning" title={error} />}
        {places && (
          <ul className="space-y-2">
            {places.length === 0 && <li className="text-sm text-muted">No branches found on the map nearby.</li>}
            {places.map((p) => (
              <li key={p.mapsUrl} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${p.matchesLender ? 'border-teal/50 bg-teal-50' : 'border-line bg-white'}`}>
                <div className="min-w-0">
                  <p className="font-bold text-navy">{p.name}</p>
                  {p.address && <p className="text-xs text-muted">{p.address}</p>}
                  {p.hours && <p className="text-xs text-muted">{p.hours}</p>}
                </div>
                <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold text-teal-600 hover:underline">
                  {`${p.distanceKm} km`} <ExternalLink className="inline h-3.5 w-3.5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
        <a href={mapSearch} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
          Open the map search <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <div className="space-y-3 rounded-2xl bg-ivory p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Documents to carry</p>
        <ul className="space-y-1 text-sm text-navy">
          {guide.carry.map((c) => (
            <li key={c} className="flex gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden /> {c}
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs font-bold uppercase tracking-wider text-muted">What happens at the visit</p>
        <ol className="space-y-2 text-sm text-navy">
          {guide.steps.map((s, i) => (
            <li key={s} className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export const LoanTools: React.FC<Props> = ({ profile, langConfig, tool, onTool, loanId, need }) => (
  <section id="loan-tools" className="card p-4 sm:p-5" aria-label="Loan tools">
    <div role="tablist" aria-label="Loan tools" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tool === t.id}
          onClick={() => onTool(t.id)}
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${tool === t.id ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy-700/40'}`}
        >
          <t.icon className="h-4 w-4" aria-hidden /> {t.label}
        </button>
      ))}
    </div>
    <div className="mt-5" role="tabpanel">
      {tool === 'budget' && <Budget key={`b-${loanId}`} loanId={loanId} need={need} profile={profile} />}
      {tool === 'plan' && <Plan langConfig={langConfig} need={need} profile={profile} />}
      {tool === 'contract' && <Contract langConfig={langConfig} />}
      {tool === 'fraud' && <Fraud langConfig={langConfig} />}
      {tool === 'bank' && <Bank key={`k-${loanId}`} loanId={loanId} profile={profile} lang={langConfig.code} />}
    </div>
  </section>
);
