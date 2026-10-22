import React, { useMemo, useState } from 'react';
import { AudioLines, CheckCircle2, ChevronDown, Circle, Compass, ExternalLink, FileBadge, Globe, Landmark, Mic, MicOff, ScanLine, Search, Sparkles } from 'lucide-react';
import type { BeneficiaryProfile, ChannelMode, Language } from '../../types';
import { DOCUMENT_CATEGORIES, DOCUMENT_SERVICES, type DocumentCategory, type DocumentService } from '../../data/documentServices';
import { FORM_SCHEMA_MAP, requirementsFor, DOC_KINDS } from '../../data/autofillSchema';
import { estimateEligibility } from '../../data/schemeCatalog';
import { autofillApi, type SessionState, type SchemeInfo } from '../../services/autofillApi';
import { useDictation } from '../smartapply/media';
import { Alert, EmptyState, Spinner, StatusPill } from '../ui/kit';

/** Switch between the two halves of Explore: schemes and official documents. */
export const ExploreTabs: React.FC<{ current: 'schemes' | 'documents'; onNavigate?: (m: ChannelMode) => void }> = ({ current, onNavigate }) =>
  onNavigate ? (
    <div role="tablist" aria-label="Explore" className="inline-flex rounded-2xl border border-line bg-white p-1">
      {[
        { id: 'schemes' as const, label: 'Government schemes', icon: Landmark },
        { id: 'documents' as const, label: 'Documents & certificates', icon: FileBadge },
      ].map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={current === tab.id}
          onClick={() => onNavigate(tab.id)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${current === tab.id ? 'bg-navy text-white' : 'text-muted hover:text-navy'}`}
        >
          <tab.icon className="h-4 w-4" aria-hidden /> {tab.label}
        </button>
      ))}
    </div>
  ) : null;

interface Props {
  profile: BeneficiaryProfile;
  langConfig: Language;
  session: SessionState | null;
  /** Open Smart Apply for this service; `byVoice` fills it by voice from the start. */
  onApply: (id: string, byVoice?: boolean) => void;
  onNavigate: (m: ChannelMode) => void;
}

const ONLINE_LABEL: Record<DocumentService['online'], string> = {
  online: 'Fully online',
  'online-and-office': 'Online + office visit',
  office: 'At the office',
};

function quickMatch(s: DocumentService, q: string) {
  if (!q.trim()) return true;
  const hay = `${s.name} ${s.summary} ${s.ministry} ${s.officialForm} ${(FORM_SCHEMA_MAP[s.id]?.keywords || []).join(' ')}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .some((w) => hay.includes(w));
}

const ServiceCard: React.FC<{ s: DocumentService; profile: BeneficiaryProfile; haveKinds: Set<string>; highlight: boolean; onApply: (id: string, byVoice?: boolean) => void }> = ({
  s,
  profile,
  haveKinds,
  highlight,
  onApply,
}) => {
  const [open, setOpen] = useState(highlight);
  const schema = FORM_SCHEMA_MAP[s.id];
  const reqs = schema ? requirementsFor(schema) : [];
  const est = estimateEligibility(s, profile);
  return (
    <li id={`svc-${s.id}`} className={`card flex flex-col p-5 sm:p-6 ${highlight ? 'ring-2 ring-teal/50' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted">{s.ministry}</p>
          <h2 className="mt-1 text-lg font-bold leading-snug text-navy">{s.name}</h2>
        </div>
        <StatusPill tone="info" icon={Globe}>{ONLINE_LABEL[s.online]}</StatusPill>
      </div>
      <p className="mt-1 text-xs font-semibold text-teal-600">Official form: {s.officialForm}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{s.summary}</p>

      <div className="mt-4 rounded-xl bg-ivory p-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Who can apply</p>
        <p className="mt-1 text-navy">{s.eligibilitySummary}</p>
        {est.level === 'unlikely' && <p className="mt-1 text-xs font-semibold text-coral-600">{est.reasons.join(' · ')}</p>}
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Documents you will need</p>
        <ul className="mt-2 space-y-2">
          {reqs.map((r) => {
            const have = r.anyOf.filter((k) => haveKinds.has(k));
            const accepted = [...r.anyOf.filter((k) => !(k === 'other' && r.alsoAccepted?.length)).map((k) => DOC_KINDS[k].label), ...(r.alsoAccepted || [])];
            return (
              <li key={r.id} className="flex gap-2.5 text-sm">
                {have.length ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />}
                <span>
                  <span className="font-semibold text-navy">
                    {r.label}
                    {!r.required && <span className="font-normal text-muted"> (if applicable)</span>}
                  </span>
                  <span className="block text-xs text-muted">
                    {have.length ? (
                      <span className="font-semibold text-green">You already added: {have.map((k) => DOC_KINDS[k].label).join(', ')}</span>
                    ) : r.manual ? (
                      r.note
                    ) : (
                      <>Any one of: {accepted.join(' · ')}</>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {open && (
        <ol className="mt-4 space-y-2 border-t border-line pt-4 animate-fade-up">
          {s.steps.map((step, i) => (
            <li key={step} className="flex gap-2.5 text-sm text-navy">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{i + 1}</span>
              {step}
            </li>
          ))}
          <li className="text-xs text-muted">Fees, timelines and the accepted-document list are set by the issuing authority — check the official portal.</li>
        </ol>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <button onClick={() => onApply(s.id)} className="btn btn-accent btn-sm h-10">
          <ScanLine className="h-4 w-4" aria-hidden /> Prepare application
        </button>
        <button onClick={() => onApply(s.id, true)} className="btn btn-success btn-sm h-10">
          <AudioLines className="h-4 w-4" aria-hidden /> By voice
        </button>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-ghost btn-sm h-10">
          {open ? 'Hide steps' : 'How to apply'} <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
          {s.officialLabel} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </li>
  );
};

export const DocumentsPage: React.FC<Props> = ({ profile, langConfig, session, onApply, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DocumentCategory | 'all'>('all');
  const [searching, setSearching] = useState(false);
  const [aiResult, setAiResult] = useState<{ scheme: SchemeInfo | null; reason: string; related: SchemeInfo[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const haveKinds = useMemo(() => new Set((session?.documents || []).map((d) => d.kind)), [session?.documents]);
  const results = DOCUMENT_SERVICES.filter((s) => (category === 'all' || s.category === category) && (aiResult?.scheme?.kind === 'document' ? true : quickMatch(s, query)));
  const highlighted = aiResult?.scheme?.kind === 'document' ? aiResult.scheme.schemeId : null;
  const ordered = highlighted ? [...results].sort((a, b) => (a.id === highlighted ? -1 : b.id === highlighted ? 1 : 0)) : results;

  const aiSearch = async (text = query) => {
    if (!text.trim()) return;
    setSearching(true);
    setError(null);
    setAiResult(null);
    try {
      const r = await autofillApi.intent(text);
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

  return (
    <div className="space-y-8">
      <ExploreTabs current="documents" onNavigate={onNavigate} />
      <header className="max-w-3xl">
        <p className="eyebrow">Documents & certificates</p>
        <h1 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">Get the right document, with the right proofs</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Describe what you need in your own words. We find the right official form, tell you which documents are accepted, and fill the application from the documents you already have.
        </p>
      </header>

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
            <label htmlFor="doc-search" className="sr-only">Describe the document you need</label>
            <input
              id="doc-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAiResult(null);
              }}
              placeholder='Try "I need proof of income for a scholarship" or "change my address in Aadhaar"'
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
              {searching ? <Spinner className="h-5 w-5" /> : <Sparkles className="h-5 w-5" aria-hidden />} AI search
            </button>
          </div>
        </form>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by category">
          {[{ id: 'all' as const, label: 'All' }, ...DOCUMENT_CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
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
          {aiResult.scheme ? (
            aiResult.scheme.kind === 'document' ? (
              <Alert tone="success" title={`Best match: ${aiResult.scheme.name}`}>
                {aiResult.reason || 'Matched from what you described.'} It is shown first below.
              </Alert>
            ) : (
              <Alert
                tone="info"
                title={`That sounds like a scheme: ${aiResult.scheme.name}`}
                action={
                  <button onClick={() => onApply(aiResult.scheme!.schemeId)} className="btn btn-primary btn-sm">
                    Prepare application
                  </button>
                }
              >
                {aiResult.reason}
              </Alert>
            )
          ) : (
            <Alert tone="neutral" title="No exact match yet">
              We support the documents listed below. Try naming the document (for example "PAN card"), or ask UDAAN AI.
            </Alert>
          )}
          {aiResult.related.length > 0 && (
            <div className="mt-3 rounded-2xl border border-line bg-white p-4">
              <p className="text-sm font-bold text-navy">You will probably also need</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {aiResult.related.map((r) => (
                  <li key={r.schemeId}>
                    <button onClick={() => onApply(r.schemeId)} className="btn btn-outline btn-sm">
                      <ScanLine className="h-4 w-4" aria-hidden /> {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 text-sm text-muted">
        <Compass className="h-4 w-4" aria-hidden /> {ordered.length} document service{ordered.length === 1 ? '' : 's'} · accepted-document lists are guides; the official portal decides.
      </p>

      {ordered.length === 0 ? (
        <EmptyState icon={Search} title="No documents match that search" body='Try simpler words like "PAN", "certificate" or "licence", or use AI search.' />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {ordered.map((s) => (
            <ServiceCard key={s.id} s={s} profile={profile} haveKinds={haveKinds} highlight={s.id === highlighted} onApply={onApply} />
          ))}
        </ul>
      )}
    </div>
  );
};
