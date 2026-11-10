import React from 'react';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { DraftView } from '../../services/autofillApi';

/**
 * Where the application stands: a readiness score with the single next thing to do,
 * and (when the form is likely to bounce) the reasons and how to fix each one.
 */
export const ReadinessPanel: React.FC<{ draft: DraftView; step: number; onGoTo: (step: number) => void }> = ({ draft, step, onGoTo }) => {
  const pct = Math.max(0, Math.min(100, Math.round(draft.completion)));
  const docsNeeded = draft.documents.filter((d) => d.required && !d.have && !d.manual).length;
  const left = draft.missing.length + draft.conflicts.length;

  // The one next move, in the order a person would do them
  let next: { text: string; to: number } | null = null;
  if (draft.generated) next = null;
  else if (docsNeeded > 0) next = { text: `Upload ${docsNeeded} more document${docsNeeded > 1 ? 's' : ''}`, to: 1 };
  else if (left > 0) next = { text: `${left} detail${left > 1 ? 's' : ''} left to fill`, to: 2 };
  else if (!draft.approved) next = { text: draft.needsReview.length ? `Check ${draft.needsReview.length} detail${draft.needsReview.length > 1 ? 's' : ''}, then approve` : 'Review and approve', to: 3 };
  else next = { text: 'Download your form', to: 4 };

  const risks = draft.risks ?? [];
  const high = risks.filter((r) => r.level === 'high');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="surface-dark rounded-[28px] p-5 text-white shadow-lift sm:p-6" aria-labelledby="ready-h">
        <div className="relative z-10">
          <p id="ready-h" className="text-xs font-bold uppercase tracking-wider text-white/70">Readiness</p>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="font-display text-5xl font-semibold leading-none" aria-label={`${pct} percent ready`}>{pct}</span>
            <span className="pb-1 text-xl text-white/70">%</span>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Application readiness">
            <div className="h-full rounded-full bg-gradient-to-r from-teal to-[#7af0df] transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          {next ? (
            <button
              onClick={() => onGoTo(next!.to)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/12 px-4 text-sm font-semibold text-white ring-1 ring-white/25 hover:bg-white/20"
              aria-current={step === next.to ? 'step' : undefined}
            >
              {next.text} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <p className="mt-4 text-sm text-white/80">Your form is ready. Nothing is sent for you.</p>
          )}
        </div>
      </section>

      {risks.length > 0 ? (
        <section
          className={`rounded-[28px] border p-5 sm:p-6 ${high.length ? 'border-coral/50 bg-coral-50' : 'border-gold/50 bg-[#fff5d8]'}`}
          aria-labelledby="risk-h"
        >
          <div className="flex items-start gap-3">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${high.length ? 'bg-coral text-navy' : 'bg-gold text-navy'}`}>
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="risk-h" className="font-display text-base font-semibold text-[#6f1c1c]">
                {high.length ? 'Likely to be rejected' : 'Could be questioned'}
              </h2>
              <ul className="mt-2 space-y-2.5">
                {risks.slice(0, 3).map((r) => (
                  <li key={r.title} className="text-sm text-[#6f1c1c]">
                    <span className="font-semibold">{r.title}.</span> <span className="opacity-90">{r.fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <section className="tint-teal rounded-[28px] border border-line p-5 sm:p-6" aria-labelledby="risk-h">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal text-navy">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 id="risk-h" className="font-display text-base font-semibold text-navy">No problems found so far</h2>
              <p className="mt-1 text-sm text-muted">We check names, dates and documents against each other. You review every field before anything is final.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
