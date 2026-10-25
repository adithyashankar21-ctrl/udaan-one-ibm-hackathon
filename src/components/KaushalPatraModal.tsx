import React, { useEffect, useRef } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  Flag,
  History,
  FileText,
  GraduationCap,
  Info,
  Landmark,
  Rocket,
  Sparkles,
  UserRound,
  Volume2,
  X,
} from 'lucide-react';
import { BeneficiaryProfile, LanguageCode, LivelihoodAnalysis, SavedRoadmap } from '../types';
import { RoadmapAsk } from './RoadmapAsk';
import { rankSchemesForProfile } from '../data/schemeCatalog';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { aiService } from '../services/aiService';
import { StatusPill } from './ui/kit';

interface KaushalPatraModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BeneficiaryProfile;
  roadmap: LivelihoodAnalysis | null;
  currentLanguage?: LanguageCode;
  savedSchemeIds?: string[];
  /** All roadmaps kept for the person (newest first), to switch between them. */
  history?: SavedRoadmap[];
  activeId?: string;
  onPick?: (id: string) => void;
  /** Ask for another roadmap (typed, spoken or tapped); '' makes one from the profile. */
  onAsk?: (request: string) => void;
  busy?: boolean;
}

/** One milestone on the vertical journey. */
const Milestone: React.FC<{
  step: number;
  icon: React.ElementType;
  title: string;
  tone?: 'saffron' | 'green' | 'navy';
  last?: boolean;
  /** Where this section's content comes from: AI suggestion or the curated scheme catalog. */
  source?: 'ai' | 'catalog' | 'you';
  children: React.ReactNode;
}> = ({ step, icon: Icon, title, tone = 'navy', last, source, children }) => {
  const toneCls = tone === 'saffron' ? 'bg-saffron text-navy' : tone === 'green' ? 'bg-green text-white' : 'bg-navy text-white';
  return (
    <li className="relative flex gap-4 sm:gap-6 break-inside-avoid">
      {!last && <span className="absolute left-[23px] top-14 bottom-0 w-0.5 bg-gradient-to-b from-saffron/50 to-teal/40 print:bg-slate-300" aria-hidden />}
      <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-card ${toneCls}`}>
        <Icon className="h-5 w-5" />
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-ivory text-[10px] font-bold text-navy">{step}</span>
      </span>
      <div className="flex-1 pb-10">
        <div className="flex flex-wrap items-center gap-2 pt-2.5">
          <h3 className="text-lg font-bold text-navy">{title}</h3>
          {source === 'ai' && <StatusPill tone="warning" icon={Sparkles}>AI-suggested · confirm before acting</StatusPill>}
          {source === 'catalog' && <StatusPill tone="info" icon={Landmark}>From scheme catalog · official links</StatusPill>}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
};

export const KaushalPatraModal: React.FC<KaushalPatraModalProps> = ({ isOpen, onClose, profile, roadmap, currentLanguage = 'en', savedSchemeIds = [], history = [], activeId, onPick, onAsk, busy }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus, Escape to close, and stop narration only when the modal actually closes
  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      aiService.stopAudio();
    };
  }, [isOpen]);

  if (!isOpen || !roadmap) return null;

  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const madeAt = history.find((h) => h.id === activeId)?.createdAt;
  const dateStr = new Date(madeAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const milestones = (roadmap.milestones || []).filter((m) => m?.title);
  // Steps are numbered in order; the plan step only appears when the roadmap has one
  let n = 0;
  const step = () => ++n;

  const schemes = rankSchemesForProfile(profile, savedSchemeIds);

  // Merge near-duplicates such as "Caste certificate" and "Caste certificate (SC)"
  const docMap = new Map<string, string>();
  schemes.flatMap((x) => x.s.documents).forEach((d) => {
    const key = d.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
    if (!docMap.has(key) || d.length > docMap.get(key)!.length) docMap.set(key, d);
  });
  const documents = Array.from(docMap.values()).slice(0, 8);
  const self = roadmap.livelihoodPathways?.selfEmployment;
  const wage = roadmap.livelihoodPathways?.wageEmployment;

  const progress = [
    { label: 'Profile shared', done: Boolean(profile.name && profile.district) },
    { label: 'Roadmap created', done: true },
    { label: 'Scheme shortlisted', done: savedSchemeIds.length > 0 },
  ];

  const nextActions = [
    !profile.annualFamilyIncome && 'Add your annual family income to your profile for better scheme matching',
    savedSchemeIds.length === 0 && 'Save one or two schemes that interest you',
    'Collect the documents listed below',
    roadmap.nsqfCourses?.[0] && `Ask a nearby training centre about “${roadmap.nsqfCourses[0].jobRole}”`,
  ].filter(Boolean) as string[];

  const listen = () => aiService.playSpeech(roadmap.audioNarrationScript || roadmap.profileSummary, lang.speechLocale);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/70 backdrop-blur-sm print:static print:bg-white" role="dialog" aria-modal="true" aria-labelledby="kp-title">
      <div className="flex min-h-full items-start justify-center p-3 sm:p-8">
        <article className="print-area w-full max-w-4xl overflow-hidden rounded-[28px] bg-ivory shadow-lift print:rounded-none print:shadow-none">
          {/* Header */}
          <header className="surface-dark px-6 py-8 sm:px-10 print:bg-navy">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">Kaushal Patra · Career roadmap</p>
                <h2 id="kp-title" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {roadmap.goal || (profile.name ? `${profile.name}'s livelihood roadmap` : 'Your livelihood roadmap')}
                </h2>
                {roadmap.request && <p className="mt-2 text-sm text-slate-200">You asked: “{roadmap.request}”</p>}
                <p className="mt-2 text-sm text-slate-300">
                  {[profile.district && `${profile.district}, ${profile.state}`, profile.education, profile.traditionalTrade || profile.currentOccupation].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-slate-400">Prepared with UDAAN ONE on {dateStr}</p>
              </div>
              <button ref={closeRef} onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 print:hidden" aria-label="Close roadmap">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="relative mt-6">
              <p className="text-xs font-semibold text-slate-300">Your progress</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {progress.map((p) => (
                  <li key={p.label} className={`flex items-center gap-1 ${p.done ? 'text-white' : 'text-slate-400'}`}>
                    {p.done ? <CheckCircle2 className="h-3.5 w-3.5 text-teal" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}
                    {p.label}
                    <span className="sr-only">{p.done ? '(done)' : '(not yet)'}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mt-6 flex flex-wrap gap-2 print:hidden">
              <button onClick={listen} className="btn btn-accent">
                <Volume2 className="h-4 w-4" /> Listen in {lang.nativeName}
              </button>
              <button onClick={() => window.print()} className="btn btn-on-dark">
                <Download className="h-4 w-4" /> Save as PDF / Print
              </button>
            </div>
          </header>

          <div className="px-5 py-8 sm:px-10">
            <p className="mb-8 flex items-start gap-2 rounded-2xl border border-saffron/30 bg-saffron-50 p-4 text-sm text-navy">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" />
              This is a personal planning guide. Sections marked "AI-suggested" were written by AI from what you shared and may be wrong; scheme
              sections come from UDAAN ONE's scheme catalog with official links. Nothing here is an official certificate, approval or eligibility
              decision — confirm details with the official portal or office.
            </p>

            <ol>
              <Milestone step={step()} icon={UserRound} title="Where you are today" tone="saffron" source="ai">
                <p className="text-sm leading-relaxed text-navy">{roadmap.profileSummary}</p>
                {roadmap.skillGapAnalysis?.strengthsIdentified?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">Your strengths</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {roadmap.skillGapAnalysis.strengthsIdentified.map((s) => (
                        <span key={s} className="rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Milestone>

              {milestones.length > 0 && (
                <Milestone step={step()} icon={Flag} title="Your step-by-step plan" tone="green" source="ai">
                  <ol className="space-y-3">
                    {milestones.map((m, i) => (
                      <li key={`${m.period}-${i}`} className="card flex gap-4 p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wider text-saffron-600">{m.period}</p>
                          <p className="font-bold text-navy">{m.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted">{m.action}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Milestone>
              )}

              <Milestone step={step()} icon={GraduationCap} title="Build your skills" source="ai">
                {roadmap.skillGapAnalysis?.missingGaps?.length > 0 && (
                  <p className="mb-3 text-sm text-muted">
                    Skills to add: <span className="text-navy">{roadmap.skillGapAnalysis.missingGaps.join(', ')}</span>
                  </p>
                )}
                <ul className="grid gap-3 sm:grid-cols-2">
                  {(roadmap.nsqfCourses || []).slice(0, 4).map((c) => (
                    <li key={c.id || c.jobRole} className="card p-4">
                      <p className="font-bold text-navy">{c.jobRole}</p>
                      <p className="mt-0.5 text-xs text-muted">{[c.nsqfLevel && `NSQF ${c.nsqfLevel.replace(/^NSQF\s*/i, '')}`, c.durationHours].filter(Boolean).join(' · ')}</p>
                      {c.whyFit && <p className="mt-2 text-sm text-muted">{c.whyFit}</p>}
                    </li>
                  ))}
                </ul>
                <a href="https://www.skillindiadigital.gov.in" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-green hover:underline print:hidden">
                  Find training centres on Skill India <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Milestone>

              <Milestone step={step()} icon={Landmark} title="Schemes worth exploring" source="catalog">
                <ul className="space-y-2.5">
                  {schemes.map(({ s, e }) => (
                    <li key={s.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
                      <div>
                        <p className="font-semibold text-navy">{s.name}</p>
                        <p className="text-xs text-muted">{e.level === 'likely' ? 'Likely eligible' : 'Need more details'} · preliminary estimate</p>
                      </div>
                      <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-green hover:underline">
                        {s.officialLabel} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </Milestone>

              <Milestone step={step()} icon={Briefcase} title="Paths to earning" tone="green" source="ai">
                <div className="grid gap-3 sm:grid-cols-2">
                  {wage && (
                    <div className="card p-4">
                      <p className="flex items-center gap-2 font-bold text-navy"><Briefcase className="h-4 w-4 text-saffron-600" /> Job</p>
                      {wage.targetEmployers?.length > 0 && <p className="mt-2 text-sm text-muted">Where to look: <span className="text-navy">{wage.targetEmployers.join(', ')}</span></p>}
                      {wage.expectedSalary && <p className="mt-1 text-sm text-muted">Typical pay (estimate): <span className="text-navy">{wage.expectedSalary}</span></p>}
                      {wage.timeline && <p className="mt-1 text-sm text-muted">Timeline: <span className="text-navy">{wage.timeline}</span></p>}
                    </div>
                  )}
                  {self && (
                    <div className="card p-4">
                      <p className="flex items-center gap-2 font-bold text-navy"><Rocket className="h-4 w-4 text-saffron-600" /> Own business</p>
                      {self.businessConcept && <p className="mt-2 text-sm text-navy">{self.businessConcept}</p>}
                      {self.projectCost && <p className="mt-1 text-sm text-muted">Estimated cost: <span className="text-navy">{self.projectCost}</span></p>}
                      <p className="mt-1 text-xs text-muted">Grant and loan amounts depend on scheme rules and bank appraisal.</p>
                    </div>
                  )}
                </div>
                {roadmap.localClusterLinkage && <p className="mt-3 text-sm text-muted">Local opportunity: <span className="text-navy">{roadmap.localClusterLinkage}</span></p>}
              </Milestone>

              <Milestone step={step()} icon={FileText} title="Documents to prepare" source="catalog">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {documents.map((d) => (
                    <li key={d} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-navy ring-1 ring-line">
                      <Circle className="h-4 w-4 text-slate-300" /> {d}
                    </li>
                  ))}
                </ul>
              </Milestone>

              <Milestone step={step()} icon={Sparkles} title="Your next actions" tone="saffron" last>
                <ol className="space-y-2">
                  {nextActions.map((a, i) => (
                    <li key={a} className="flex gap-3 text-sm text-navy">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{i + 1}</span>
                      {a}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-sm text-muted">Need help? Call the toll-free helpline 1800-11-2529.</p>
              </Milestone>
            </ol>

            {(onAsk || history.length > 1) && (
              <section className="mt-2 space-y-6 border-t border-line pt-8 print:hidden">
                {onAsk && (
                  <div>
                    <h3 className="text-lg font-bold text-navy">Make another roadmap</h3>
                    <p className="mb-3 text-sm text-muted">For a different goal — say it, type it or pick one.</p>
                    <RoadmapAsk compact speechLocale={lang.speechLocale} busy={busy} onAsk={onAsk} />
                  </div>
                )}
                {history.length > 1 && onPick && (
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-bold text-navy">
                      <History className="h-5 w-5 text-teal-600" aria-hidden /> Your roadmaps
                    </h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {history.map((h) => (
                        <li key={h.id}>
                          <button
                            onClick={() => onPick(h.id)}
                            aria-current={h.id === activeId ? 'true' : undefined}
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${h.id === activeId ? 'border-teal bg-teal-50' : 'border-line bg-white hover:border-teal/50'}`}
                          >
                            <span className="block font-semibold text-navy">{h.roadmap.goal || 'Roadmap from your profile'}</span>
                            <span className="text-xs text-muted">{new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </div>
        </article>
      </div>
    </div>
  );
};
