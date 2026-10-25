import React, { useMemo, useState } from 'react';
import { ArrowRight, BadgeCheck, BookOpen, Briefcase, Clock, Code2, ExternalLink, GraduationCap, Layers, Rocket } from 'lucide-react';
import { BeneficiaryProfile, ChannelMode, Language } from '../../types';
import { NSQF_COURSES } from '../../data/nsqfCourses';
import { SchemesPage } from './SchemesPage';
import { StatusPill } from '../ui/kit';
import { RoadmapAsk } from '../RoadmapAsk';

interface SkillsPageProps {
  profile: BeneficiaryProfile;
  langConfig: Language;
  savedIds: string[];
  onToggleSave: (id: string) => void;
  onOpenProfile: () => void;
  onApply?: (schemeId: string) => void;
  onNavigate?: (mode: ChannelMode) => void;
  /** Opens the Learning Hub with a course built for this job role. */
  onLearn?: (topic: string, context?: string) => void;
  /** Makes a career roadmap for a goal in the person's words ('' = from the profile). */
  onAskRoadmap?: (request: string) => void;
  isGeneratingRoadmap?: boolean;
}

/** Segmented switch shared by the two halves of "Skills & Opportunities". */
export const OpportunityTabs: React.FC<{ current: 'skills' | 'learning' | 'enterprise'; onNavigate?: (mode: ChannelMode) => void }> = ({ current, onNavigate }) =>
  onNavigate ? (
    <div role="tablist" aria-label="Skills and opportunities" className="inline-flex max-w-full overflow-x-auto rounded-2xl border border-line bg-white p-1">
      {[
        { id: 'skills' as const, label: 'Training & jobs', icon: Briefcase },
        { id: 'learning' as const, label: 'Learning Hub', icon: BookOpen },
        { id: 'enterprise' as const, label: 'Start a business', icon: Rocket },
      ].map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={current === tab.id}
          onClick={() => onNavigate(tab.id)}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${current === tab.id ? 'bg-navy text-white' : 'text-muted hover:text-navy'}`}
        >
          <tab.icon className="h-4 w-4" aria-hidden /> {tab.label}
        </button>
      ))}
    </div>
  ) : null;

export const SkillsPage: React.FC<SkillsPageProps> = ({ onNavigate, onLearn, onAskRoadmap, isGeneratingRoadmap, ...props }) => {
  const sectors = useMemo(() => ['All', ...Array.from(new Set(NSQF_COURSES.map((c) => c.sector.split(/[&/(]/)[0].trim())))], []);
  const [sector, setSector] = useState('All');
  const courses = NSQF_COURSES.filter((c) => sector === 'All' || c.sector.startsWith(sector));

  return (
    <div className="space-y-14">
      <section className="space-y-6">
        <OpportunityTabs current="skills" onNavigate={onNavigate} />
        <header className="max-w-3xl">
          <p className="eyebrow">Skills & Opportunities</p>
          <h1 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">Build on the skills you already have</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Job roles aligned to the National Skills Qualifications Framework (NSQF). Course availability, batches and fees vary by centre — confirm on
            Skill India Digital Hub before enrolling.
          </p>
        </header>

        {onAskRoadmap && <RoadmapAsk speechLocale={props.langConfig.speechLocale} busy={isGeneratingRoadmap} onAsk={onAskRoadmap} />}

        {onNavigate && (
          <button
            onClick={() => onNavigate('learning')}
            className="surface-dark group flex w-full flex-col gap-4 rounded-[22px] p-5 text-left text-white transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-row sm:items-center sm:p-6"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-teal text-navy">
              <Code2 className="h-7 w-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-saffron">New · Learning Hub</span>
              <span className="mt-1 block text-lg font-bold">Learn Python, C, Java, web development and more — free, with an AI tutor</span>
              <span className="mt-1 block text-sm text-white/70">Lessons for every subtopic, code you can run, and step-by-step answers to your doubts.</span>
            </span>
            <span className="btn btn-accent shrink-0">
              Open Learning Hub <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </button>
        )}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by sector">
          {sectors.map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              aria-pressed={sector === s}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${sector === s ? 'border-navy bg-navy text-white' : 'border-line bg-white text-navy hover:border-navy-700/40'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-600">
                  <GraduationCap className="h-5 w-5" aria-hidden />
                </span>
                {c.stipendSupported && <StatusPill tone="info" icon={BadgeCheck}>Stipend may apply</StatusPill>}
              </div>
              <h2 className="mt-4 font-bold leading-snug text-navy">{c.jobRole}</h2>
              <p className="mt-1 text-xs font-semibold text-muted">{c.sector}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{c.whyFit}</p>
              <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-navy">
                <div className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-saffron-600" aria-hidden /><dt className="sr-only">Level</dt><dd>NSQF {c.nsqfLevel}</dd></div>
                <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-saffron-600" aria-hidden /><dt className="sr-only">Duration</dt><dd>{c.durationHours}</dd></div>
              </dl>
              {c.prerequisites && <p className="mt-3 rounded-xl bg-ivory p-3 text-xs text-navy"><strong>Before you join:</strong> {c.prerequisites}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
                {onLearn && (
                  <button
                    onClick={() =>
                      onLearn(
                        `${c.jobRole} basics`,
                        `NSQF ${c.nsqfLevel} job role ${c.jobRole} (${c.qpCode}) in the ${c.sector} sector. Typical duration ${c.durationHours}. Prerequisites: ${c.prerequisites || 'not specified'}. Certifying body: ${c.certifyingBody || 'Sector Skill Council'}.`
                      )
                    }
                    className="btn btn-primary btn-sm"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden /> Learn the basics with Guru
                  </button>
                )}
                <a
                  href="https://www.skillindiadigital.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-teal-600 hover:underline"
                >
                  Find a centre <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <SchemesPage
        {...props}
        lockedFilters={['skilling', 'employment']}
        heading="Training & employment schemes"
        intro="Government programmes for free training, certification and finding work."
      />
    </div>
  );
};
