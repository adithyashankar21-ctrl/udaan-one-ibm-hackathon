import React from 'react';
import type { LivelihoodAnalysis } from '../types';

/**
 * The career roadmap as a printed document (A4 portrait): what printing or "Save as PDF" gives.
 * It is kept in the page (hidden) so the app's translation reaches it, and printed on its own by
 * printElement. Sections never split across pages.
 */
export interface RoadmapPrintProps {
  roadmap: LivelihoodAnalysis;
  name?: string;
  details?: string;
  dateStr: string;
  schemes: Array<{ id: string; name: string; officialUrl: string; officialLabel: string; likely: boolean }>;
  documents: string[];
  nextActions: string[];
}

const keep: React.CSSProperties = { breakInside: 'avoid', pageBreakInside: 'avoid' };

const Section: React.FC<{ n: number; title: string; tag?: string; children: React.ReactNode }> = ({ n, title, tag, children }) => (
  <section style={keep} className="mt-6">
    <div className="mb-2.5 flex items-center gap-2.5 border-b-2 border-saffron/60 pb-1.5" style={{ breakAfter: 'avoid' }}>
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-[11px] font-bold text-white">{n}</span>
      <h2 className="text-[15px] font-extrabold text-navy">{title}</h2>
      {tag && <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-muted">{tag}</span>}
    </div>
    {children}
  </section>
);

export const RoadmapPrint: React.FC<RoadmapPrintProps> = ({ roadmap, name, details, dateStr, schemes, documents, nextActions }) => {
  const steps = (roadmap.milestones || []).filter((m) => m?.title);
  const wage = roadmap.livelihoodPathways?.wageEmployment;
  const self = roadmap.livelihoodPathways?.selfEmployment;
  const strengths = roadmap.skillGapAnalysis?.strengthsIdentified || [];
  const gaps = roadmap.skillGapAnalysis?.missingGaps || [];
  let n = 0;
  const next = () => ++n;

  return (
    <article className="roadmap-print bg-white text-[11.5px] leading-[1.55] text-navy">
      {/* Title band */}
      <header style={keep} className="overflow-hidden rounded-2xl bg-navy px-7 py-6 text-white">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal">UDAAN ONE · Kaushal Patra · Career roadmap</p>
            <h1 className="mt-1.5 text-[26px] font-extrabold leading-tight">{roadmap.goal || (name ? `${name}'s livelihood roadmap` : 'Your livelihood roadmap')}</h1>
            {roadmap.request && <p className="mt-1.5 text-[12px] text-white/80">You asked: “{roadmap.request}”</p>}
          </div>
          <div className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-right text-[10.5px] leading-snug text-white/85">
            {name && (
              <p translate="no" className="text-[12px] font-bold text-white">
                {name}
              </p>
            )}
            {details && <p>{details}</p>}
            <p>Prepared on {dateStr}</p>
          </div>
        </div>
      </header>

      <p style={keep} className="mt-4 rounded-xl border border-saffron/40 bg-saffron-50 px-4 py-2.5 text-[10px] leading-relaxed text-navy">
        A personal planning guide made with UDAAN ONE. Parts marked “AI-suggested” were written by AI and may be wrong; scheme details come from UDAAN ONE’s scheme catalogue with
        official links. It is not an official certificate, approval or eligibility decision — confirm on the official portal or office.
      </p>

      <Section n={next()} title="Where you are today" tag="AI-suggested">
        <p>{roadmap.profileSummary}</p>
        {(strengths.length > 0 || gaps.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {strengths.length > 0 && (
              <div className="rounded-xl bg-green-50 p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-green">Your strengths</p>
                <ul className="mt-1 list-disc pl-4">
                  {strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {gaps.length > 0 && (
              <div className="rounded-xl bg-saffron-50 p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-saffron-600">Skills to add</p>
                <ul className="mt-1 list-disc pl-4">
                  {gaps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      {steps.length > 0 && (
        <Section n={next()} title="Your step-by-step plan" tag="AI-suggested">
          <ol className="relative">
            {steps.map((m, i) => (
              <li key={`${m.period}-${i}`} style={keep} className="relative flex gap-3.5 pb-3 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-saffron/50" />}
                <span className="relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full bg-saffron text-[11px] font-extrabold text-navy">{i + 1}</span>
                <div className="min-w-0 flex-1 rounded-xl border border-line px-3.5 py-2">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-saffron-600">{m.period}</p>
                  <p className="font-bold">{m.title}</p>
                  <p className="text-muted">{m.action}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {(roadmap.nsqfCourses || []).length > 0 && (
        <Section n={next()} title="Courses to build your skills" tag="AI-suggested">
          <div className="grid grid-cols-2 gap-2.5">
            {(roadmap.nsqfCourses || []).slice(0, 4).map((c) => (
              <div key={c.jobRole} style={keep} className="rounded-xl border border-line p-3">
                <p className="font-bold">{c.jobRole}</p>
                <p className="text-[10px] text-muted">
                  {[c.nsqfLevel && `NSQF ${String(c.nsqfLevel).replace(/^NSQF\s*/i, '')}`, c.durationHours, c.sector].filter(Boolean).join(' · ')}
                </p>
                {c.whyFit && <p className="mt-1 text-[10.5px]">{c.whyFit}</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted">
            Find training centres: <a href="https://www.skillindiadigital.gov.in">skillindiadigital.gov.in</a>
          </p>
        </Section>
      )}

      {(wage || self) && (
        <Section n={next()} title="Ways to earn" tag="AI-suggested · estimates">
          <div className="grid grid-cols-2 gap-2.5">
            {wage && (
              <div style={keep} className="rounded-xl border border-line p-3">
                <p className="font-bold">A job</p>
                {wage.targetEmployers?.length > 0 && <p className="mt-1">Where to look: {wage.targetEmployers.join(', ')}</p>}
                {wage.expectedSalary && <p className="mt-1 text-muted">Typical pay (estimate): {wage.expectedSalary}</p>}
                {wage.timeline && <p className="mt-1 text-muted">Timeline: {wage.timeline}</p>}
              </div>
            )}
            {self && (
              <div style={keep} className="rounded-xl border border-line p-3">
                <p className="font-bold">Your own business</p>
                {self.businessConcept && <p className="mt-1">{self.businessConcept}</p>}
                {self.projectCost && <p className="mt-1 text-muted">Estimated cost: {self.projectCost}</p>}
                {self.bankLoanMudra && <p className="mt-1 text-muted">Loans: {self.bankLoanMudra}</p>}
              </div>
            )}
          </div>
          {roadmap.localClusterLinkage && <p className="mt-2 text-[10.5px] text-muted">Local opportunity: {roadmap.localClusterLinkage}</p>}
        </Section>
      )}

      {schemes.length > 0 && (
        <Section n={next()} title="Schemes worth exploring" tag="From the scheme catalogue">
          <table className="w-full border-collapse text-left">
            <tbody>
              {schemes.map((s) => (
                <tr key={s.id} style={keep} className="border-b border-line last:border-0">
                  <td className="py-1.5 pr-3 font-semibold">{s.name}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-[10px] text-muted">{s.likely ? 'Likely eligible' : 'Need more details'}</td>
                  <td className="py-1.5 text-right text-[10px]">
                    <a href={s.officialUrl} className="text-teal-600 underline">
                      {s.officialLabel}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {documents.length > 0 && (
        <Section n={next()} title="Documents to prepare">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {documents.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-[3px] border-[1.5px] border-navy/60" /> {d}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {nextActions.length > 0 && (
        <Section n={next()} title="Your next actions">
          <ol className="space-y-1.5">
            {nextActions.map((a, i) => (
              <li key={a} className="flex gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-bold text-white">{i + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <footer style={keep} className="mt-7 flex items-center justify-between border-t border-line pt-2.5 text-[9.5px] text-muted">
        <span>
          <strong className="text-navy">UDAAN ONE</strong> · AI for Opportunity. Technology for All.
        </span>
        <span>Help: toll-free 1800-11-2529</span>
      </footer>
    </article>
  );
};

/** Page set-up for the roadmap: page numbers at the foot of every page. */
export const ROADMAP_PRINT_CSS = `
@page { @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 600 8.5px "Plus Jakarta Sans", sans-serif; color: #6b7896; } }
`;
