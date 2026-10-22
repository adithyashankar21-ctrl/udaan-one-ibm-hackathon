import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRightCircle, Camera, CheckCircle2, Circle, FileText, RotateCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { DOC_KINDS, PROFILE_FIELD_MAP, type DocKind } from '../../data/autofillSchema';
import type { SmartApplyStrings } from '../../data/smartApplyStrings';
import { autofillApi, type DocCheck, type DocRecord, type DraftView, type SessionState, type UploadFile } from '../../services/autofillApi';
import { Alert, EmptyState, Spinner, StatusPill, UploadZone } from '../ui/kit';
import { CameraScanner } from './CameraScanner';
import { PhotoCard } from './PhotoCard';
import { ConfidenceBadge } from './badges';
import { prepareFile } from './media';

export interface Preview {
  url: string;
  mime: string;
}

interface Job {
  id: number;
  label: string;
  phase: 'preparing' | 'uploading' | 'reading' | 'done' | 'failed';
  error?: string;
  docId?: string;
  previews: Preview[];
}

interface Props {
  t: SmartApplyStrings;
  draft: DraftView;
  documents: DocRecord[];
  photo: SessionState['photo'];
  previews: Record<string, Preview[]>;
  onPreviews: (docId: string, previews: Preview[]) => void;
  onSession: (s: SessionState) => void;
  onRefreshDraft: () => void;
}

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

const toPreview = (f: UploadFile): Preview => {
  const bytes = Uint8Array.from(atob(f.dataBase64), (c) => c.charCodeAt(0));
  return { url: URL.createObjectURL(new Blob([bytes], { type: f.mimeType })), mime: f.mimeType };
};

/** Shows a document locally (object URL in this tab only — the server keeps no original). */
const DocPreview: React.FC<{ previews?: Preview[]; scanning?: boolean; label: string }> = ({ previews, scanning, label }) => {
  const first = previews?.[0];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-navy-50">
      {first ? (
        first.mime === 'application/pdf' ? (
          <object data={first.url} type="application/pdf" aria-label={label} className="h-80 w-full sm:h-[26rem]">
            <p className="p-6 text-sm text-muted">PDF preview is not available in this browser.</p>
          </object>
        ) : /image\/(jpeg|png|webp)/.test(first.mime) ? (
          <img src={first.url} alt={label} className="h-80 w-full object-contain sm:h-[26rem]" />
        ) : (
          <div className="grid h-80 place-items-center text-sm text-muted">Preview not available for this format</div>
        )
      ) : (
        <div className="grid h-80 place-items-center p-6 text-center text-sm text-muted sm:h-[26rem]">
          <span>
            <FileText className="mx-auto mb-2 h-8 w-8" aria-hidden />
            The original file is not kept after reading. Preview is only available right after you upload it in this tab.
          </span>
        </div>
      )}
      {previews && previews.length > 1 && <StatusPill tone="accent" className="absolute left-3 top-3">{previews.length} pages</StatusPill>}
      {scanning && (
        <div className="pointer-events-none absolute inset-0 bg-navy/10" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-1/2 animate-scan bg-gradient-to-b from-transparent via-teal/40 to-transparent" />
        </div>
      )}
    </div>
  );
};

const CHECK_META: Record<DocCheck['status'], { icon: React.ElementType; color: string; sr: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green', sr: 'Passed' },
  warn: { icon: AlertTriangle, color: 'text-saffron-600', sr: 'Needs attention' },
  fail: { icon: XCircle, color: 'text-coral-600', sr: 'Failed' },
};

/** The automatic checks run on one document, failures first. */
const DocChecks: React.FC<{ doc: DocRecord }> = ({ doc }) => {
  const order = { fail: 0, warn: 1, pass: 2 };
  const checks = [...(doc.checks || [])].sort((a, b) => order[a.status] - order[b.status]);
  if (!checks.length) return null;
  return (
    <section aria-label="Document checks" className={`mt-4 rounded-xl border p-3 ${doc.usable ? 'border-line bg-ivory' : 'border-coral/30 bg-coral-50'}`}>
      <p className="text-sm font-bold text-navy">
        {doc.usable ? 'Checks on this document' : 'This document cannot be used for your application'}
      </p>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => {
          const m = CHECK_META[c.status];
          return (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <m.icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.color}`} aria-hidden />
              <span>
                <span className="sr-only">{m.sr}: </span>
                <span className="font-semibold text-navy">{c.label}</span>
                {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const docPill = (d: DocRecord) =>
  !d.usable ? (
    <StatusPill tone="danger">Can’t use</StatusPill>
  ) : d.checks?.some((c) => c.status === 'warn') ? (
    <StatusPill tone="warning">Check</StatusPill>
  ) : (
    <StatusPill tone="success">Passed checks</StatusPill>
  );

export const DocumentStep: React.FC<Props> = ({ t, draft, documents, photo, previews, onPreviews, onSession, onRefreshDraft }) => {
  const photoRef = useRef<HTMLElement>(null);
  const [hint, setHint] = useState<DocKind | ''>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, Record<string, string>>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const patchJob = (id: number, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const active = jobs.find((j) => j.phase !== 'done' && j.phase !== 'failed');

  // Select the newest document automatically
  useEffect(() => {
    if (!selected && documents.length) setSelected(documents[documents.length - 1].id);
    if (selected && !documents.some((d) => d.id === selected) && !jobs.some((j) => String(j.id) === selected)) setSelected(documents[0]?.id || null);
  }, [documents, selected, jobs]);

  const send = async (load: () => Promise<UploadFile[]>, label: string) => {
    const id = Date.now() + Math.random();
    setJobs((js) => [{ id, label, phase: 'preparing', previews: [] }, ...js]);
    setSelected(String(id));
    try {
      const files = await load();
      const local = files.map(toPreview);
      patchJob(id, { phase: 'uploading', previews: local });
      const timer = setTimeout(() => patchJob(id, { phase: 'reading' }), 500);
      const res = await autofillApi.uploadDocument(files, hint || undefined);
      clearTimeout(timer);
      onPreviews(res.document.id, local);
      patchJob(id, { phase: 'done', docId: res.document.id, label: res.document.label });
      setSelected(res.document.id);
      onSession(res);
      onRefreshDraft();
    } catch (err: any) {
      patchJob(id, { phase: 'failed', error: err?.message || 'Upload failed' });
    }
  };

  const onFiles = (list: File[]) => {
    const pdfs = list.filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    const images = list.filter((f) => !pdfs.includes(f));
    for (const pdf of pdfs) send(() => prepareFile(pdf).then((x) => [x]), pdf.name);
    // Several photos picked together are read as the pages of one document
    if (images.length) send(() => Promise.all(images.map(prepareFile)), images.length > 1 ? `${images.length} photos` : images[0].name);
  };

  const remove = async (docId: string) => {
    onSession(await autofillApi.deleteDocument(docId));
    setSelected(null);
    onRefreshDraft();
  };

  const saveChecked = async (doc: DocRecord) => {
    const values = { ...(edits[doc.id] || {}) };
    for (const f of doc.fields) if (f.value && values[f.key] === undefined) values[f.key] = f.value;
    const res = await autofillApi.confirmDocument(doc.id, values);
    setSaveErrors((e) => ({ ...e, [doc.id]: res.errors }));
    if (Object.keys(res.errors).length === 0) {
      setEdits((e) => ({ ...e, [doc.id]: {} }));
      setSaved(doc.id);
      setTimeout(() => setSaved(null), 2500);
    }
    onSession(res);
    onRefreshDraft();
  };

  const phaseText: Record<Job['phase'], string> = { preparing: t.preparing, uploading: t.uploading, reading: t.reading, done: t.done, failed: t.failed };
  const selectedDoc = documents.find((d) => d.id === selected);
  const selectedJob = jobs.find((j) => String(j.id) === selected || (j.docId && j.docId === selected && j.phase !== 'done'));
  const failedJobs = jobs.filter((j) => j.phase === 'failed');
  const formKeys = useMemo(() => new Set(draft.fields.map((f) => f.key)), [draft.fields]);
  const heldBack = Boolean(selectedDoc?.checks?.some((c) => c.id === 'holder' && c.status !== 'pass'));
  const requiredMissing = useMemo(() => draft.documents.filter((d) => d.required && !d.have && !d.manual), [draft.documents]);

  return (
    <div className="space-y-6">
      {/* Checklist */}
      <section className="card p-5 sm:p-6" aria-labelledby="docs-needed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="docs-needed" className="text-lg font-bold text-navy">{t.docsNeeded}</h2>
          <StatusPill tone={requiredMissing.length ? 'warning' : 'success'}>
            {requiredMissing.length ? `${requiredMissing.length} required still to add` : 'All required documents added'}
          </StatusPill>
        </div>
        <p className="mt-1 text-sm text-muted">Each requirement can be met by any one of the accepted documents. The official portal or office has the final list.</p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {draft.documents.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => (d.id === 'photo' ? photoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : !d.manual && setHint(d.kind as DocKind))}
                disabled={d.manual}
                className={`flex min-h-12 w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${
                  d.have ? 'border-green/30 bg-green-50' : hint === d.kind && !d.manual ? 'border-navy bg-white' : 'border-line bg-white hover:border-navy-700/40'
                }`}
                aria-label={`${d.label}: ${d.have ? `${t.have} (${d.satisfiedBy.join(', ')})` : d.manual ? 'bring or upload yourself' : d.required ? t.required : t.optional}. Accepted: ${d.accepted.join(', ')}`}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                    {d.have ? <CheckCircle2 className="h-5 w-5 shrink-0 text-green" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />}
                    {d.label}
                  </span>
                  <StatusPill tone={d.have ? 'success' : d.manual ? 'neutral' : d.required ? 'warning' : 'neutral'}>
                    {d.have ? t.have : d.manual ? 'Bring yourself' : d.required ? t.required : t.optional}
                  </StatusPill>
                </span>
                <span className="pl-7 text-xs text-muted">
                  {d.have ? (
                    <>Using: <span className="font-semibold text-navy">{d.satisfiedBy.join(', ')}</span></>
                  ) : d.manual ? (
                    d.note
                  ) : (
                    <>Any of: {d.accepted.join(' · ')}</>
                  )}
                </span>
                {!d.have && d.rejected?.length > 0 && (
                  <span className="pl-7 text-xs font-semibold text-coral-600">
                    {d.rejected.map((r) => `${r.label} uploaded but not usable: ${r.reason}`).join(' · ')}
                  </span>
                )}
                {d.warnings?.map((w) => (
                  <span key={w} className="flex items-start gap-1 pl-7 text-xs font-semibold text-saffron-600">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
                  </span>
                ))}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <PhotoCard ref={photoRef} photo={photo} onSession={onSession} onChanged={onRefreshDraft} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: add + preview */}
        <div className="space-y-4">
          <UploadZone onFiles={onFiles} accept={ACCEPT} title={t.upload} hint={t.uploadHint}>
            <button type="button" onClick={() => setScanning(true)} className="btn btn-outline">
              <Camera className="h-4 w-4" aria-hidden /> {t.scan}
            </button>
          </UploadZone>

          <label className="block text-sm font-semibold text-navy">
            {t.docType}
            <select value={hint} onChange={(e) => setHint(e.target.value as DocKind | '')} className="field mt-1.5">
              <option value="">{t.autoDetect}</option>
              {(Object.keys(DOC_KINDS) as DocKind[]).map((k) => (
                <option key={k} value={k}>{DOC_KINDS[k].label}</option>
              ))}
            </select>
          </label>

          <p className="flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-relaxed text-muted ring-1 ring-line">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green" aria-hidden />
            Originals are read and then discarded — only the details are kept, encrypted. Aadhaar is masked to the last 4 digits. Reading a document does not verify that it is genuine.
          </p>

          {failedJobs.map((j) => (
            <Alert key={j.id} tone="danger" title={`${j.label}: ${t.failed}`}>
              {j.error}
            </Alert>
          ))}

          {/* Document list */}
          {(documents.length > 0 || active) && (
            <ul className="space-y-2" aria-label="Your documents" aria-live="polite">
              {active && (
                <li className="flex items-center gap-3 rounded-xl border border-teal/30 bg-teal-50/60 p-3">
                  <Spinner className="h-5 w-5 text-teal-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">{active.label}</span>
                    <span className="block text-xs text-muted">{phaseText[active.phase]}</span>
                  </span>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white sm:block" aria-hidden>
                    <span className={`block h-full rounded-full bg-teal transition-all duration-700 ${active.phase === 'preparing' ? 'w-1/4' : active.phase === 'uploading' ? 'w-1/2' : 'w-5/6'}`} />
                  </span>
                </li>
              )}
              {[...documents].reverse().map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setSelected(d.id)}
                    aria-pressed={selected === d.id}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected === d.id ? 'border-navy bg-white shadow-card' : 'border-line bg-white/70 hover:bg-white'}`}
                  >
                    <FileText className="h-5 w-5 shrink-0 text-navy-700" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy">{d.label}</span>
                      <span className="block truncate text-xs text-muted">
                        {d.fields.filter((f) => f.value).length} details read · {d.pageCount} page{d.pageCount === 1 ? '' : 's'}
                      </span>
                    </span>
                    {docPill(d)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: preview + extracted fields */}
        <div className="space-y-4">
          {selectedJob && selectedJob.phase !== 'done' && selectedJob.phase !== 'failed' ? (
            <section className="card p-5" aria-busy="true">
              <DocPreview previews={selectedJob.previews} scanning label={selectedJob.label} />
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-navy">
                <Spinner className="h-4 w-4 text-teal-600" /> {phaseText[selectedJob.phase]}
              </p>
              <div className="mt-3 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="skeleton block h-10" />
                ))}
              </div>
            </section>
          ) : selectedDoc ? (
            <section className="card p-5 sm:p-6" aria-label={`${selectedDoc.label} details`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-navy">{selectedDoc.label}</h3>
                  <p className="truncate text-xs text-muted">{selectedDoc.fileNames.join(', ')}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusPill tone="info" icon={ShieldCheck}>{t.notVerified}</StatusPill>
                    <ConfidenceBadge value={selectedDoc.kindConfidence} t={t} />
                    {selectedDoc.quality.rotated && <StatusPill tone="neutral" icon={RotateCw}>Rotated page read</StatusPill>}
                    {selectedDoc.validity?.issueDate && <StatusPill tone="neutral">Issued {selectedDoc.validity.issueDate}</StatusPill>}
                    {selectedDoc.quality.overall !== 'good' && (
                      <StatusPill tone="warning" icon={AlertTriangle}>
                        Image quality: {selectedDoc.quality.overall}
                      </StatusPill>
                    )}
                  </div>
                  {selectedDoc.quality.issues.length > 0 && <p className="mt-1.5 text-xs text-muted">{selectedDoc.quality.issues.join(' · ')}</p>}
                </div>
                <button onClick={() => remove(selectedDoc.id)} className="btn btn-ghost btn-sm text-muted">
                  <Trash2 className="h-4 w-4" aria-hidden /> {t.removeDoc}
                </button>
              </div>

              <DocChecks doc={selectedDoc} />

              <div className="mt-4">
                <DocPreview previews={previews[selectedDoc.id]} label={selectedDoc.label} />
              </div>

              <ul className="mt-5 divide-y divide-line">
                {selectedDoc.fields.map((f) => {
                  const def = PROFILE_FIELD_MAP[f.key];
                  const docEdits = edits[selectedDoc.id] || {};
                  const err = saveErrors[selectedDoc.id]?.[f.key];
                  const current = docEdits[f.key] ?? f.value ?? '';
                  const id = `${selectedDoc.id}-${f.key}`;
                  return (
                    <li key={f.key} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor={id} className="text-sm font-semibold text-navy">{def?.label || f.key}</label>
                        <span className="flex flex-wrap gap-1.5">
                          {f.merged && formKeys.has(f.key) && <StatusPill tone="success" icon={ArrowRightCircle}>Filled into this application</StatusPill>}
                          {f.legible ? <ConfidenceBadge value={f.confidence} t={t} /> : <StatusPill tone="danger" icon={XCircle}>{t.unreadable}</StatusPill>}
                        </span>
                      </div>
                      <input
                        id={id}
                        value={current}
                        readOnly={f.key === 'aadhaar' && Boolean(f.value)}
                        placeholder={f.legible ? '' : 'Could not read — type it here'}
                        aria-invalid={Boolean(err) || !f.legible}
                        aria-describedby={f.note || err ? `${id}-note` : undefined}
                        onChange={(e) => setEdits((all) => ({ ...all, [selectedDoc.id]: { ...(all[selectedDoc.id] || {}), [f.key]: e.target.value } }))}
                        className={`field mt-1.5 ${f.legible && f.confidence < 0.85 ? 'border-saffron/60' : ''}`}
                      />
                      {(f.note || err) && (
                        <p id={`${id}-note`} className={`mt-1 text-xs ${err ? 'text-coral-600' : 'text-muted'}`}>
                          {err || f.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {selectedDoc.extraFields.length > 0 && (
                <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-ivory p-3 text-xs sm:grid-cols-2">
                  {selectedDoc.extraFields.map((x) => (
                    <div key={x.label} className="flex gap-2">
                      <dt className="font-semibold text-muted">{x.label}:</dt>
                      <dd translate="no" className="text-navy">{x.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={() => saveChecked(selectedDoc)} className="btn btn-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> {heldBack ? 'Use these details for the applicant' : t.saveChecked}
                </button>
                {heldBack && (
                  <span className="text-xs text-muted">Only if this is your own document. A parent’s or spouse’s document used as proof should not fill your details.</span>
                )}
                {saved === selectedDoc.id && (
                  <span role="status" className="text-sm font-semibold text-green animate-fade-up">
                    Saved — these details are now marked as checked by you.
                  </span>
                )}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              body="Upload a PDF or photo, or scan pages with your camera. We will read the details and show them here for you to check."
            />
          )}
        </div>
      </div>

      {scanning && (
        <CameraScanner
          onClose={() => setScanning(false)}
          onDone={(files) => {
            setScanning(false);
            send(async () => files, `${files.length} scanned page${files.length === 1 ? '' : 's'}`);
          }}
        />
      )}
    </div>
  );
};
