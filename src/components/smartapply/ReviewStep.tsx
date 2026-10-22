import React, { useState } from 'react';
import { Check, Lock, PencilLine, X } from 'lucide-react';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import type { LanguageCode } from '../../types';
import { autofillApi, type DraftView, type FieldView } from '../../services/autofillApi';
import { Alert, StatusPill } from '../ui/kit';
import { FieldStateBadge, LEGEND, STATE_RING, SourceNote } from './badges';

interface Props {
  t: SmartApplyStrings;
  language: LanguageCode;
  draft: DraftView;
  onDraft: (draft: DraftView, fieldsHash?: string) => void;
}

const display = (f: FieldView) => (f.type === 'money' && /^\d+$/.test(f.value) ? `₹${Number(f.value).toLocaleString('en-IN')}` : f.value);

const FieldRow: React.FC<{ t: SmartApplyStrings; f: FieldView; hi: boolean; draftId: string; onDraft: Props['onDraft'] }> = ({ t, f, hi, draftId, onDraft }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(f.value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = `review-${f.key}`;
  const locked = f.type === 'aadhaar' && Boolean(f.value);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await autofillApi.editFields(draftId, { [f.key]: value });
      if (res.errors[f.key]) setError(res.errors[f.key]);
      else setEditing(false);
      onDraft(res.draft, res.fieldsHash);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-2xl border bg-white p-4 transition-colors ${STATE_RING[f.state]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">
            {hi && f.labelHi ? f.labelHi : f.label}
            {f.required && <span className="text-coral-600" aria-label="required"> *</span>}
          </p>
          {!editing && (
            <p translate={f.value ? 'no' : undefined} className={`mt-0.5 break-words text-base font-bold ${f.value ? 'text-navy' : 'text-muted'}`}>{f.value ? display(f) : '—'}</p>
          )}
        </div>
        <FieldStateBadge field={f} />
      </div>

      {editing ? (
        <div className="mt-2">
          <label htmlFor={id} className="sr-only">{f.label}</label>
          {f.options ? (
            <select id={id} value={value} onChange={(e) => setValue(e.target.value)} className="field" aria-invalid={Boolean(error)}>
              <option value="">—</option>
              {f.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input id={id} value={value} onChange={(e) => setValue(e.target.value)} className="field" aria-invalid={Boolean(error)} autoFocus />
          )}
          {error && <p className="mt-1 text-xs text-coral-600" role="alert">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={save} disabled={busy} className="btn btn-success btn-sm">
              <Check className="h-4 w-4" aria-hidden /> {t.save}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setValue(f.value);
                setError(null);
              }}
              className="btn btn-ghost btn-sm"
            >
              <X className="h-4 w-4" aria-hidden /> {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <SourceNote field={f} t={t} />
          {locked ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Masked for privacy
            </span>
          ) : (
            <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm text-teal-600" aria-label={`${t.edit} ${f.label}`}>
              <PencilLine className="h-4 w-4" aria-hidden /> {f.value ? t.edit : 'Add'}
            </button>
          )}
        </div>
      )}
      {f.issues.length > 0 && !editing && (
        <ul className="mt-2 space-y-0.5 text-xs text-navy/80">
          {f.issues.map((i) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      )}
    </li>
  );
};

export const ReviewStep: React.FC<Props> = ({ t, language, draft, onDraft }) => {
  const hi = language === 'hi';
  const counts = {
    filled: draft.fields.filter((f) => f.value && f.state !== 'conflict' && f.state !== 'invalid').length,
    review: draft.needsReview.length,
    missing: draft.missing.length,
  };

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-lg font-bold text-navy">{t.reviewTitle}</h2>
            <p className="mt-1 text-sm text-muted">{t.reviewHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="success">{counts.filled} filled</StatusPill>
            {counts.review > 0 && <StatusPill tone="warning">{counts.review} to check</StatusPill>}
            {counts.missing > 0 && <StatusPill tone="neutral">{counts.missing} missing</StatusPill>}
          </div>
        </div>
        <details className="mt-4 rounded-xl bg-ivory p-3">
          <summary className="cursor-pointer text-sm font-semibold text-navy">What the labels mean</summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {LEGEND.map((l) => (
              <li key={l.label}>
                <StatusPill tone={l.tone} icon={l.icon}>{l.label}</StatusPill>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">"From document" means our reader read it from your upload. UDAAN ONE cannot check that a document is genuine — the office will verify your originals.</p>
        </details>
      </section>

      {draft.approvalStale && <Alert tone="warning" title={t.approvalStale} />}

      {draft.sections.map((section) => (
        <section key={section} aria-labelledby={`sec-${section}`}>
          <h3 id={`sec-${section}`} className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">{section}</h3>
          <ul className="grid gap-3 md:grid-cols-2">
            {draft.fields
              .filter((f) => f.section === section)
              .map((f) => (
                <FieldRow key={`${f.key}-${f.value}-${f.state}`} t={t} f={f} hi={hi} draftId={draft.id} onDraft={onDraft} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
