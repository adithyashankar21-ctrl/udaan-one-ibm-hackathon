import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  GitCompare,
  HelpCircle,
  Mic,
  ScanLine,
  Search,
  X,
  XCircle,
  AudioLines,
} from 'lucide-react';
import { BeneficiaryProfile, Language } from '../../types';
import { CatalogScheme, EligibilityLevel, SCHEME_CATALOG, SchemeFilter, estimateEligibility } from '../../data/schemeCatalog';
import { FORM_SCHEMA_MAP } from '../../data/autofillSchema';
import { ExploreTabs } from './DocumentsPage';
import type { ChannelMode } from '../../types';

interface SchemesPageProps {
  profile: BeneficiaryProfile;
  langConfig: Language;
  savedIds: string[];
  onToggleSave: (id: string) => void;
  onOpenProfile: () => void;
  /** Restrict to these filters (used by Skills & Jobs / Entrepreneurship pages). */
  lockedFilters?: SchemeFilter[];
  heading?: string;
  intro?: string;
  /** Start a Smart Apply application for this scheme. */
  /** Open Smart Apply for this scheme; `byVoice` fills it by voice from the start. */
  onApply?: (schemeId: string, byVoice?: boolean) => void;
  /** Shows the Schemes / Documents switch (top-level Explore page only). */
  onNavigate?: (mode: ChannelMode) => void;
}

const FILTERS: Array<{ id: SchemeFilter; label: string }> = [
  { id: 'skilling', label: 'Skilling' },
  { id: 'employment', label: 'Employment' },
  { id: 'education', label: 'Education' },
  { id: 'livelihood', label: 'Livelihood' },
  { id: 'entrepreneurship', label: 'Entrepreneurship' },
];

// Everyday words people use, mapped to filters, for natural-language search
const SYNONYMS: Record<string, SchemeFilter> = {
  business: 'entrepreneurship', shop: 'entrepreneurship', loan: 'entrepreneurship', enterprise: 'entrepreneurship', startup: 'entrepreneurship',
  job: 'employment', jobs: 'employment', work: 'employment', employment: 'employment',
  training: 'skilling', course: 'skilling', skill: 'skilling', skills: 'skilling', certificate: 'skilling',
  scholarship: 'education', study: 'education', college: 'education', student: 'education',
  livelihood: 'livelihood', income: 'livelihood', grant: 'livelihood', artisan: 'livelihood',
};

export const ELIGIBILITY_META: Record<EligibilityLevel, { label: string; cls: string; icon: React.ElementType }> = {
  likely: { label: 'Likely eligible', cls: 'bg-green-50 text-green border-green/20', icon: CheckCircle2 },
  'needs-info': { label: 'Need more details', cls: 'bg-saffron-50 text-saffron-600 border-saffron/30', icon: HelpCircle },
  unlikely: { label: 'May not match', cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle },
};

function matchesQuery(s: CatalogScheme, q: string): boolean {
  if (!q.trim()) return true;
  const words = q.toLowerCase().split(/[^a-z0-9ऀ-ൿ]+/).filter((w) => w.length > 2);
  if (words.length === 0) return true;
  const hay = `${s.name} ${s.summary} ${s.ministry} ${s.keySupport.join(' ')} ${s.eligibilitySummary}`.toLowerCase();
  return words.some((w) => hay.includes(w) || (SYNONYMS[w] && s.filters.includes(SYNONYMS[w])));
}

export const SchemesPage: React.FC<SchemesPageProps> = ({
  profile,
  langConfig,
  savedIds,
  onToggleSave,
  onOpenProfile,
  lockedFilters,
  onApply,
  onNavigate,
  heading = 'Explore government schemes',
  intro = 'Search in your own words or by voice. Each result shows a preliminary eligibility estimate based on your profile and links to the official source.',
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<SchemeFilter[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const pool = lockedFilters ? SCHEME_CATALOG.filter((s) => s.filters.some((f) => lockedFilters.includes(f))) : SCHEME_CATALOG;
  const results = useMemo(
    () => pool.filter((s) => (active.length === 0 || s.filters.some((f) => active.includes(f))) && matchesQuery(s, query)),
    [pool, active, query]
  );

  const estimates = useMemo(() => Object.fromEntries(pool.map((s) => [s.id, estimateEligibility(s, profile)])), [pool, profile]);

  const toggleFilter = (f: SchemeFilter) => setActive((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]));
  const toggleCompare = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));

  const voiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = langConfig.speechLocale || 'en-IN';
    rec.interimResults = false;
    rec.onresult = (e: any) => setQuery(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const filterOptions = lockedFilters ? FILTERS.filter((f) => lockedFilters.includes(f.id)) : FILTERS;
  const compared = SCHEME_CATALOG.filter((s) => compare.includes(s.id));

  return (
    <div className="space-y-8">
      {!lockedFilters && <ExploreTabs current="schemes" onNavigate={onNavigate} />}
      <header className="max-w-3xl">
        <p className="eyebrow">{lockedFilters ? 'Related schemes' : 'Discover'}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">{heading}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{intro}</p>
      </header>

      {/* Search + filters */}
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <label htmlFor="scheme-search" className="sr-only">Search schemes</label>
            <input
              id="scheme-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "loan to start a tailoring shop" or "free training"'
              className="field h-14 rounded-2xl bg-ivory pl-12 text-base focus:bg-white"
            />
          </div>
          <button
            onClick={voiceSearch}
            className={`flex h-14 w-14 items-center justify-center rounded-2xl transition ${listening ? 'bg-saffron text-navy animate-pulse' : 'bg-navy text-white hover:bg-navy-800'}`}
            aria-label={listening ? 'Stop voice search' : 'Search by voice'}
          >
            <Mic className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter schemes">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => toggleFilter(f.id)}
              aria-pressed={active.includes(f.id)}
              className={`h-10 rounded-full border px-4 text-sm font-semibold transition ${
                active.includes(f.id) ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-saffron/60'
              }`}
            >
              {f.label}
            </button>
          ))}
          {(active.length > 0 || query) && (
            <button onClick={() => { setActive([]); setQuery(''); }} className="h-10 px-3 text-sm font-semibold text-muted hover:text-navy">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Eligibility explainer */}
      <div className="flex flex-col gap-3 rounded-2xl border border-saffron/30 bg-saffron-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-navy">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" />
          <span>
            Eligibility shown here is a <strong>preliminary estimate</strong> from your profile — not an official decision. Rules and benefits change; confirm on the official portal.
          </span>
        </p>
        <button onClick={onOpenProfile} className="h-11 shrink-0 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-800">
          Check my eligibility
        </button>
      </div>

      {/* Results */}
      <p className="text-sm font-semibold text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? 'scheme' : 'schemes'} found
      </p>

      {results.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <Search className="h-10 w-10 text-muted" />
          <p className="mt-4 font-bold text-navy">No schemes match that search</p>
          <p className="mt-1 text-sm text-muted">Try simpler words like “loan”, “training” or “job”, or clear the filters.</p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {results.map((s) => {
            const est = estimates[s.id];
            const meta = ELIGIBILITY_META[est.level];
            const saved = savedIds.includes(s.id);
            const open = expanded === s.id;
            return (
              <li key={s.id} className="card flex flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted">{s.ministry}</p>
                    <h2 className="mt-1 text-lg font-bold leading-snug text-navy">{s.name}</h2>
                  </div>
                  <button
                    onClick={() => onToggleSave(s.id)}
                    aria-pressed={saved}
                    aria-label={saved ? 'Remove from saved' : 'Save scheme'}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${saved ? 'border-green bg-green-50 text-green' : 'border-line text-muted hover:text-navy'}`}
                  >
                    {saved ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                  </button>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted">{s.summary}</p>

                <div className={`mt-4 rounded-xl border p-3 ${meta.cls}`}>
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <meta.icon className="h-4 w-4" />
                    {meta.label} <span className="font-medium opacity-80">· preliminary</span>
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-navy/80">
                    {est.reasons.map((r) => (
                      <li key={r}>• {r}</li>
                    ))}
                  </ul>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {s.keySupport.map((k) => (
                    <li key={k} className="flex items-start gap-2 text-sm text-navy">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" />
                      {k}
                    </li>
                  ))}
                </ul>

                {open && (
                  <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2 animate-fade-up">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">Who can apply</p>
                      <p className="mt-1.5 text-sm text-navy">{s.eligibilitySummary}</p>
                      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">Documents usually needed</p>
                      <ul className="mt-1.5 space-y-1">
                        {s.documents.map((d) => (
                          <li key={d} className="flex items-center gap-2 text-sm text-navy">
                            <FileText className="h-3.5 w-3.5 text-saffron-600" /> {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">How to apply</p>
                      <ol className="mt-1.5 space-y-2">
                        {s.steps.map((step, i) => (
                          <li key={step} className="flex gap-2.5 text-sm text-navy">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                      <p className="mt-4 text-xs text-muted">Deadlines: check the official portal — many schemes accept applications through the year, others open in cycles.</p>
                    </div>
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                  {onApply && FORM_SCHEMA_MAP[s.id] && (
                    <>
                      <button onClick={() => onApply(s.id)} className="btn btn-accent btn-sm h-10">
                        <ScanLine className="h-4 w-4" aria-hidden /> Start application
                      </button>
                      <button onClick={() => onApply(s.id, true)} className="btn btn-success btn-sm h-10">
                        <AudioLines className="h-4 w-4" aria-hidden /> By voice
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setExpanded(open ? null : s.id)}
                    aria-expanded={open}
                    className="btn btn-primary btn-sm h-10"
                  >
                    {open ? 'Hide details' : 'Documents & steps'}
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-navy">
                    <input
                      type="checkbox"
                      checked={compare.includes(s.id)}
                      onChange={() => toggleCompare(s.id)}
                      disabled={!compare.includes(s.id) && compare.length >= 3}
                      className="h-4 w-4 accent-[#176B52]"
                    />
                    Compare
                  </label>
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-green hover:underline"
                  >
                    Source: {s.officialLabel} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Compare tray */}
      {compare.length > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 lg:bottom-4 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-navy p-3 pl-5 text-white shadow-lift animate-fade-up">
          <span className="text-sm font-semibold">
            {compare.length} selected <span className="text-slate-400">· up to 3</span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCompare([])} className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-300 hover:text-white">Clear</button>
            <button
              onClick={() => setShowCompare(true)}
              disabled={compare.length < 2}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-saffron px-4 text-sm font-bold text-navy disabled:opacity-50"
            >
              <GitCompare className="h-4 w-4" /> Compare
            </button>
          </div>
        </div>
      )}

      {showCompare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" role="dialog" aria-modal="true" aria-label="Compare schemes" onClick={() => setShowCompare(false)}>
          <div className="card max-h-[85vh] w-full max-w-5xl overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-navy">Compare schemes</h2>
              <button onClick={() => setShowCompare(false)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-ivory" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr>
                    <th className="w-36 p-3" />
                    {compared.map((s) => (
                      <th key={s.id} className="p-3 align-top font-bold text-navy">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    { label: 'Support', render: (s: CatalogScheme) => s.keySupport.join('; ') },
                    { label: 'Who can apply', render: (s: CatalogScheme) => s.eligibilitySummary },
                    { label: 'Your estimate', render: (s: CatalogScheme) => ELIGIBILITY_META[estimates[s.id].level].label + ' (preliminary)' },
                    { label: 'Documents', render: (s: CatalogScheme) => s.documents.join(', ') },
                    { label: 'Official source', render: (s: CatalogScheme) => s.officialLabel },
                  ].map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="p-3 align-top text-xs font-bold uppercase tracking-wider text-muted">{row.label}</th>
                      {compared.map((s) => (
                        <td key={s.id} className="p-3 align-top text-navy">{row.render(s)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
