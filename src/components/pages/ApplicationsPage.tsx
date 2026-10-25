import React from 'react';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
  FileSearch,
  FileText,
  Mic,
  ScanLine,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { BeneficiaryProfile, ChannelMode, LanguageCode, LivelihoodAnalysis } from '../../types';
import { SCHEME_CATALOG, estimateEligibility, rankSchemesForProfile } from '../../data/schemeCatalog';
import { FORM_SCHEMA_MAP } from '../../data/autofillSchema';
import { getShellStrings } from '../../data/uiStrings';
import type { DraftSummary, SessionState } from '../../services/autofillApi';
import { ELIGIBILITY_META } from './SchemesPage';
import { EmptyState, Meter, SkeletonCard, StatusPill, type Tone } from '../ui/kit';

interface ApplicationsPageProps {
  language: LanguageCode;
  profile: BeneficiaryProfile;
  roadmap: LivelihoodAnalysis | null;
  savedIds: string[];
  onToggleSave: (id: string) => void;
  onNavigate: (mode: ChannelMode) => void;
  onOpenProfile: () => void;
  onGenerateRoadmap: () => void;
  onOpenKaushalPatra: () => void;
  isGeneratingRoadmap: boolean;
  session: SessionState | null;
  onOpenDraft: (id: string) => void;
  onApply: (schemeId: string) => void;
}

const WELCOME: Partial<Record<LanguageCode, string>> = {
  en: 'Welcome',
  hi: 'स्वागत है',
  ta: 'வணக்கம்',
  te: 'స్వాగతం',
  kn: 'ಸ್ವಾಗತ',
  ml: 'സ്വാഗതം',
};

/** Real workflow stages from Smart Apply — never "submitted" or "approved by government". */
const STAGE: Record<string, { tone: Tone; label: string }> = {
  collecting: { tone: 'warning', label: 'Draft · details needed' },
  review: { tone: 'info', label: 'Needs your review' },
  approved: { tone: 'success', label: 'Ready to download' },
  prepared: { tone: 'success', label: 'Downloaded · not submitted' },
};

const DraftRow: React.FC<{ d: DraftSummary; onOpen: () => void }> = ({ d, onOpen }) => {
  const stage = STAGE[d.status.code] || STAGE.collecting;
  const action = d.status.code === 'approved' || d.status.code === 'prepared' ? 'Download' : d.status.code === 'review' ? 'Review' : 'Continue';
  return (
    <li className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
      <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy sm:grid">
        <FileSearch className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-navy">{d.schemeName}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusPill tone={stage.tone}>{stage.label}</StatusPill>
          <span>Ref {d.reference}</span>
          <span aria-hidden>·</span>
          <span>Updated {new Date(d.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
          <Meter value={d.docsHave} max={d.docsRequired} label={`${d.docsHave} of ${d.docsRequired} required documents`} tone="teal" />
          <p className="text-xs text-muted sm:pt-3.5">
            {d.missingCount ? `${d.missingCount} detail(s) missing` : 'All details filled'}
            {d.conflictCount ? ` · ${d.conflictCount} to confirm` : ''}
          </p>
        </div>
      </div>
      <button onClick={onOpen} className="btn btn-primary self-start sm:self-center">
        {action} <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
};

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  language,
  profile,
  roadmap,
  savedIds,
  onToggleSave,
  onNavigate,
  onOpenProfile,
  onGenerateRoadmap,
  onOpenKaushalPatra,
  isGeneratingRoadmap,
  session,
  onOpenDraft,
  onApply,
}) => {
  const t = getShellStrings(language);
  const saved = SCHEME_CATALOG.filter((s) => savedIds.includes(s.id));
  const recommended = rankSchemesForProfile(profile, [], 6)
    .filter((x) => x.e.level === 'likely' && !savedIds.includes(x.s.id))
    .slice(0, 3);
  const drafts = [...(session?.drafts || [])].sort((a, b) => b.updatedAt - a.updatedAt);
  const latest = drafts.find((d) => d.status.code !== 'prepared') || drafts[0];

  const profileChecks = [
    { label: 'Name', done: Boolean(profile.name) },
    { label: 'District', done: Boolean(profile.district) },
    { label: 'Education', done: Boolean(profile.education) },
    { label: 'Trade or skill', done: Boolean(profile.traditionalTrade || profile.currentOccupation) },
    { label: 'Annual family income', done: Boolean(profile.annualFamilyIncome) },
    { label: 'Social category', done: Boolean(profile.socialCategory) },
  ];
  const doneChecks = profileChecks.filter((c) => c.done).length;

  // Pending actions come only from real gaps in drafts and profile
  const actions: Array<{ label: string; detail?: string; onClick: () => void }> = [
    ...drafts
      .filter((d) => d.missingDocs.length)
      .slice(0, 2)
      .map((d) => ({ label: `Add ${d.missingDocs.slice(0, 2).join(' and ').toLowerCase()}`, detail: d.schemeName, onClick: () => onOpenDraft(d.id) })),
    ...drafts
      .filter((d) => d.conflictCount)
      .slice(0, 1)
      .map((d) => ({ label: `Confirm ${d.conflictCount} conflicting detail(s)`, detail: d.schemeName, onClick: () => onOpenDraft(d.id) })),
    ...drafts
      .filter((d) => d.status.code === 'review')
      .slice(0, 1)
      .map((d) => ({ label: 'Review and approve your application', detail: d.schemeName, onClick: () => onOpenDraft(d.id) })),
    ...profileChecks
      .filter((c) => !c.done)
      .slice(0, 2)
      .map((c) => ({ label: `Add your ${c.label.toLowerCase()}`, detail: 'Improves recommendations', onClick: onOpenProfile })),
  ].slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="surface-dark flex flex-col gap-6 rounded-[28px] p-7 sm:flex-row sm:items-end sm:justify-between sm:p-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">{t.nav.applications}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            {WELCOME[language] || WELCOME.en}
            {profile.name ? `, ${profile.name}` : ''}
          </h1>
          <p className="mt-2 max-w-xl text-slate-300">Your applications, saved opportunities and next steps in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('smart_apply')} className="btn btn-accent btn-lg">
            <ScanLine className="h-5 w-5" aria-hidden /> New application
          </button>
          <button onClick={() => onNavigate('voice_studio')} className="btn btn-on-dark btn-lg">
            <Mic className="h-5 w-5" aria-hidden /> {t.nav.assistant}
          </button>
        </div>
      </section>

      {/* Continue */}
      {latest && (
        <section className="card flex flex-col gap-4 border-teal/30 p-5 sm:flex-row sm:items-center sm:p-6" aria-labelledby="cont-h">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-600">
            <FileSearch className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Continue where you left off</p>
            <h2 id="cont-h" className="truncate text-lg font-bold text-navy">{latest.schemeName}</h2>
            <p className="text-sm text-muted">{latest.status.detail}</p>
          </div>
          <button onClick={() => onOpenDraft(latest.id)} className="btn btn-primary btn-lg">
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Applications */}
          <section className="card p-5 sm:p-6" aria-labelledby="apps-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="apps-h" className="flex items-center gap-2 text-lg font-bold text-navy">
                <ClipboardList className="h-5 w-5 text-teal-600" aria-hidden /> Your applications
              </h2>
              {drafts.length > 0 && <span className="text-sm text-muted">{drafts.length} in progress</span>}
            </div>
            {!session ? (
              <div className="mt-4">
                <SkeletonCard lines={2} />
              </div>
            ) : drafts.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={ScanLine}
                  title="No applications yet"
                  body="Start with Smart Apply: choose a scheme, add your documents, and we fill the form for you to check."
                  action={
                    <button onClick={() => onNavigate('smart_apply')} className="btn btn-primary">
                      Start an application <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  }
                />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {drafts.map((d) => (
                  <DraftRow key={d.id} d={d} onOpen={() => onOpenDraft(d.id)} />
                ))}
              </ul>
            )}
            <p className="mt-4 rounded-xl bg-ivory p-3 text-xs text-muted">
              UDAAN ONE prepares applications with you. Applications are submitted and decided on official portals or offices — their status appears
              here only if an official integration confirms it. None is connected yet.
            </p>
          </section>

          {/* Recommended */}
          <section className="card p-5 sm:p-6" aria-labelledby="rec-h">
            <h2 id="rec-h" className="flex items-center gap-2 text-lg font-bold text-navy">
              <Sparkles className="h-5 w-5 text-saffron-600" aria-hidden /> Recommended for you
            </h2>
            {recommended.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Add your age, category and income to your profile to see schemes that may fit.{' '}
                <button onClick={onOpenProfile} className="font-semibold text-teal-600 hover:underline">Complete profile</button>
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {recommended.map(({ s, e }) => (
                  <li key={s.id} className="flex flex-col rounded-2xl border border-line p-4">
                    <p className="text-sm font-bold leading-snug text-navy">{s.name}</p>
                    <StatusPill tone="success" className="mt-2 w-fit">Preliminary match</StatusPill>
                    <p className="mt-2 text-xs text-muted">{e.reasons[0]}</p>
                    <div className="mt-auto flex flex-wrap gap-3 pt-3">
                      {FORM_SCHEMA_MAP[s.id] && (
                        <button onClick={() => onApply(s.id)} className="text-sm font-semibold text-teal-600 hover:underline">Apply</button>
                      )}
                      <button onClick={() => onToggleSave(s.id)} className="text-sm font-semibold text-muted hover:text-navy">Save</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Saved */}
          <section className="card p-5 sm:p-6" aria-labelledby="saved-h">
            <div className="flex items-center justify-between">
              <h2 id="saved-h" className="flex items-center gap-2 text-lg font-bold text-navy">
                <Bookmark className="h-5 w-5 text-saffron-600" aria-hidden /> Saved opportunities
              </h2>
              {saved.length > 0 && (
                <button onClick={() => onNavigate('schemes')} className="text-sm font-semibold text-teal-600 hover:underline">Find more</button>
              )}
            </div>
            {saved.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  compact
                  icon={Bookmark}
                  title="Nothing saved yet"
                  body="Tap the bookmark on any scheme to keep it here."
                  action={
                    <button onClick={() => onNavigate('schemes')} className="btn btn-outline">
                      Explore schemes <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {saved.map((s) => {
                  const meta = ELIGIBILITY_META[estimateEligibility(s, profile).level];
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-semibold text-navy">{s.name}</p>
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>
                          <meta.icon className="h-3 w-3" aria-hidden /> {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {FORM_SCHEMA_MAP[s.id] && (
                          <button onClick={() => onApply(s.id)} className="btn btn-outline btn-sm">Apply</button>
                        )}
                        <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline">
                          Official site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                        <button onClick={() => onToggleSave(s.id)} className="text-sm font-semibold text-muted hover:text-navy">Remove</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="actions-h">
            <h2 id="actions-h" className="text-lg font-bold text-navy">Next actions</h2>
            {actions.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-green">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Nothing pending right now.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {actions.map((a) => (
                  <li key={a.label + a.detail}>
                    <button onClick={a.onClick} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-ivory px-4 py-3 text-left hover:bg-ivory-200">
                      <span>
                        <span className="block text-sm font-semibold text-navy">{a.label}</span>
                        {a.detail && <span className="block text-xs text-muted">{a.detail}</span>}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-navy" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="profile-h">
            <h2 id="profile-h" className="flex items-center gap-2 text-lg font-bold text-navy">
              <UserRound className="h-5 w-5 text-teal-600" aria-hidden /> Your profile
            </h2>
            <div className="mt-4">
              <Meter value={doneChecks} max={profileChecks.length} label={`${doneChecks} of ${profileChecks.length} key details added`} />
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {profileChecks.map((c) => (
                <li key={c.label} className={`flex items-center gap-1.5 ${c.done ? 'text-navy' : 'text-muted'}`}>
                  {c.done ? <CheckCircle2 className="h-3.5 w-3.5 text-green" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}
                  {c.label}
                  <span className="sr-only">{c.done ? '(added)' : '(missing)'}</span>
                </li>
              ))}
            </ul>
            <button onClick={onOpenProfile} className="btn btn-outline mt-4 w-full">Edit profile</button>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="docs-h">
            <h2 id="docs-h" className="flex items-center gap-2 text-lg font-bold text-navy">
              <FileText className="h-5 w-5 text-saffron-600" aria-hidden /> Career roadmap
            </h2>
            {roadmap ? (
              <>
                {roadmap.goal && <p className="mt-2 font-semibold text-navy">{roadmap.goal}</p>}
                <p className="mt-1 text-sm text-muted">Your AI-suggested Kaushal Patra roadmap is ready{roadmap.milestones?.length ? `, with ${roadmap.milestones.length} steps` : ''}.</p>
                <button onClick={onOpenKaushalPatra} className="btn btn-success mt-4 w-full">Open roadmap</button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">Turn your goal into practical steps — training, schemes, documents and next actions.</p>
                <button onClick={onGenerateRoadmap} disabled={isGeneratingRoadmap} className="btn btn-primary mt-4 w-full">
                  {isGeneratingRoadmap ? 'Preparing…' : 'Create roadmap'}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
