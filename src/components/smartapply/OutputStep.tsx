import React, { useRef, useState } from 'react';
import { BadgeCheck, Download, ExternalLink, FileCheck2, FileUp, KeyRound, PhoneCall, ShieldAlert, Trash2 } from 'lucide-react';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import { autofillApi, type DraftView } from '../../services/autofillApi';
import { Alert, Spinner, StatusPill } from '../ui/kit';
import { prepareFile } from './media';

interface Props {
  t: SmartApplyStrings;
  draft: DraftView;
  fieldsHash: string;
  onDraft: (draft: DraftView, fieldsHash?: string) => void;
  onGoTo: (step: number) => void;
  onDeleteAll: () => void;
}

export const OutputStep: React.FC<Props> = ({ t, draft, fieldsHash, onDraft, onGoTo, onDeleteAll }) => {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aadhaar, setAadhaar] = useState('');
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const officialInput = useRef<HTMLInputElement>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const approve = () =>
    run('approve', async () => {
      const res = await autofillApi.approve(draft.id, fieldsHash);
      onDraft(res.draft, res.fieldsHash);
    });

  const download = (use: 'draft' | 'official') =>
    run(use, async () => {
      await autofillApi.downloadPdf(draft.id, { use, aadhaarFull: aadhaar.replace(/\D/g, '') || undefined });
      setAadhaar('');
      const res = await autofillApi.getDraft(draft.id);
      onDraft(res.draft, res.fieldsHash);
    });

  const uploadOfficial = (file: File) =>
    run('official-upload', async () => {
      const prepared = await prepareFile(file);
      const res = await autofillApi.uploadOfficialForm(draft.id, prepared);
      onDraft(res.draft);
    });

  const blockers = [
    ...(draft.missing.length ? [{ label: `${draft.missing.length} required detail(s) missing`, step: 2 }] : []),
    ...(draft.conflicts.length ? [{ label: `${draft.conflicts.length} detail(s) need you to choose the right value`, step: 2 }] : []),
    ...(draft.documents.some((d) => d.id === 'photo' && !d.have) ? [{ label: 'Add your passport-size photo — it is printed on the form', step: 1 }] : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        {/* Approve */}
        <section className="card p-5 sm:p-6" aria-labelledby="approve-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="approve-h" className="text-lg font-bold text-navy">1. {t.approve}</h2>
            {draft.approved ? <StatusPill tone="success" icon={BadgeCheck}>{t.approved}</StatusPill> : <StatusPill tone="neutral">Not approved yet</StatusPill>}
          </div>
          {blockers.length > 0 ? (
            <div className="mt-4 space-y-2">
              {blockers.map((b) => (
                <Alert key={b.label} tone="warning" title={b.label} action={<button onClick={() => onGoTo(b.step)} className="btn btn-outline btn-sm">Fix now</button>} />
              ))}
            </div>
          ) : draft.approved ? (
            <p className="mt-3 text-sm text-muted">You approved these details. If you change anything, you will be asked to approve again.</p>
          ) : (
            <>
              {draft.approvalStale && <Alert tone="warning" className="mt-4" title={t.approvalStale} />}
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-ivory p-4 text-sm font-semibold text-navy">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#168568]" />
                {t.approveCheck}
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={approve} disabled={!checked || busy === 'approve'} className="btn btn-success btn-lg">
                  {busy === 'approve' ? <Spinner className="h-4 w-4" /> : <BadgeCheck className="h-5 w-5" aria-hidden />} {t.approve}
                </button>
                <button onClick={() => onGoTo(3)} className="btn btn-ghost btn-lg">Review again</button>
              </div>
            </>
          )}
        </section>

        {/* Download */}
        <section className={`card p-5 sm:p-6 ${draft.approved ? '' : 'opacity-60'}`} aria-labelledby="dl-h" aria-disabled={!draft.approved}>
          <h2 id="dl-h" className="text-lg font-bold text-navy">2. {t.downloadTitle}</h2>
          <div className="mt-4">
            <label htmlFor="aadhaar-full" className="text-sm font-semibold text-navy">{t.aadhaarOptional}</label>
            <input
              id="aadhaar-full"
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/[^\d ]/g, '').slice(0, 14))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="XXXX XXXX XXXX"
              disabled={!draft.approved}
              className="field mt-1.5 max-w-xs tracking-widest"
              aria-describedby="aadhaar-hint"
            />
            <p id="aadhaar-hint" className="mt-1 text-xs text-muted">{t.aadhaarOptionalHint}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={() => download('draft')} disabled={!draft.approved || busy === 'draft'} className="btn btn-primary btn-lg">
              {busy === 'draft' ? <Spinner className="h-4 w-4" /> : <Download className="h-5 w-5" aria-hidden />} {t.downloadDraft}
            </button>
            {draft.officialForm && (
              <button onClick={() => download('official')} disabled={!draft.approved || busy === 'official'} className="btn btn-teal btn-lg">
                {busy === 'official' ? <Spinner className="h-4 w-4" /> : <FileCheck2 className="h-5 w-5" aria-hidden />} {t.downloadOfficial}
              </button>
            )}
          </div>
          {draft.generated && (
            <p className="mt-3 text-sm font-semibold text-green" role="status">
              PDF created {new Date(draft.generated.at).toLocaleString('en-IN')}. It has not been submitted anywhere.
            </p>
          )}
        </section>

        {/* Official form */}
        <section className="card p-5 sm:p-6" aria-labelledby="official-h">
          <h2 id="official-h" className="text-lg font-bold text-navy">{t.officialFormTitle} <span className="text-sm font-semibold text-muted">(optional)</span></h2>
          <p className="mt-1 text-sm text-muted">{t.officialFormHint}</p>
          {draft.officialForm ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ivory p-3">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold text-navy">{draft.officialForm.name}</span>
                  <span className="block text-xs text-muted">
                    {draft.officialForm.kind === 'acroform'
                      ? `Fillable PDF · ${draft.officialForm.fillable} of ${draft.officialForm.total} form fields matched to your details`
                      : `Scanned form · ${draft.officialForm.fillable} answer positions found`}
                  </span>
                </span>
                <button onClick={() => run('official-remove', async () => onDraft((await autofillApi.removeOfficialForm(draft.id)).draft))} className="btn btn-ghost btn-sm">
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove
                </button>
              </div>
              {draft.officialForm.kind === 'scanned' && (
                <Alert tone="warning" title="Check the placement before you print">
                  Positions on a scanned form are detected automatically and may be slightly off.
                  {draft.officialForm.unplaced.length > 0 && ` Fill these by hand: ${draft.officialForm.unplaced.join(', ')}.`}
                </Alert>
              )}
            </div>
          ) : (
            <button onClick={() => officialInput.current?.click()} disabled={busy === 'official-upload'} className="btn btn-outline mt-4">
              {busy === 'official-upload' ? <Spinner className="h-4 w-4" /> : <FileUp className="h-4 w-4" aria-hidden />} {busy === 'official-upload' ? 'Reading the form layout…' : t.uploadOfficial}
            </button>
          )}
          <input
            ref={officialInput}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) uploadOfficial(f);
            }}
          />
        </section>

        {error && <Alert tone="danger" title={error} />}
      </div>

      {/* Status & continuity */}
      <aside className="space-y-6">
        <section className="surface-dark rounded-[var(--radius-card)] p-5 sm:p-6" aria-labelledby="status-h">
          <p className="text-xs font-bold uppercase tracking-wider text-teal">{t.statusTitle}</p>
          <h2 id="status-h" className="mt-2 text-xl font-extrabold">{draft.status.label}</h2>
          <p className="mt-1 text-sm text-slate-300">{draft.status.detail}</p>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.06] p-3 text-sm text-slate-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-saffron" aria-hidden />
            {t.notSubmitted}
          </p>
          <ol className="mt-5 space-y-3">
            {draft.nextSteps.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm text-slate-200">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <a href={draft.scheme.submission.url} target="_blank" rel="noopener noreferrer" className="btn btn-accent mt-5 w-full">
            {t.officialSite}: {draft.scheme.officialLabel} <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </section>

        <section className="card p-5" aria-labelledby="pin-h">
          <h2 id="pin-h" className="flex items-center gap-2 font-bold text-navy">
            <PhoneCall className="h-4 w-4 text-teal-600" aria-hidden /> {t.helplineTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">{t.helplineHint}</p>
          <p className="mt-3 text-sm text-navy">
            Reference: <span className="font-mono text-base font-bold tracking-wider">{draft.reference}</span>
          </p>
          {draft.hasPin && !pinMsg ? (
            <StatusPill tone="success" className="mt-2">PIN set</StatusPill>
          ) : null}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run('pin', async () => {
                await autofillApi.setPin(draft.id, pin);
                setPin('');
                setPinMsg(t.pinSet);
                onDraft((await autofillApi.getDraft(draft.id)).draft);
              });
            }}
          >
            <label htmlFor="pin" className="sr-only">PIN</label>
            <input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="new-password" type="password" placeholder="4–6 digit PIN" className="field max-w-[10rem]" />
            <button disabled={pin.length < 4 || busy === 'pin'} className="btn btn-primary">
              <KeyRound className="h-4 w-4" aria-hidden /> {draft.hasPin ? 'Change PIN' : t.setPin}
            </button>
          </form>
          {pinMsg && <p className="mt-2 text-sm font-semibold text-green" role="status">{pinMsg}</p>}
        </section>

        <section className="card p-5" aria-labelledby="privacy-h">
          <h2 id="privacy-h" className="font-bold text-navy">Your data</h2>
          <p className="mt-1 text-sm text-muted">Stored encrypted and deleted automatically after a period of no use. You can delete everything now.</p>
          {confirmDelete ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={onDeleteAll} className="btn btn-danger">
                <Trash2 className="h-4 w-4" aria-hidden /> Yes, delete everything
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn btn-ghost">{t.cancel}</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="btn btn-danger mt-3">
              <Trash2 className="h-4 w-4" aria-hidden /> {t.deleteAll}
            </button>
          )}
        </section>
      </aside>
    </div>
  );
};
