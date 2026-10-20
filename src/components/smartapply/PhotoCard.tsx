import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Trash2, UserRound, XCircle } from 'lucide-react';
import { autofillApi, type DocCheck, type SessionState } from '../../services/autofillApi';
import { Alert, Spinner, StatusPill } from '../ui/kit';
import { preparePassportPhoto } from './media';

interface Props {
  photo: SessionState['photo'];
  onSession: (s: SessionState) => void;
  onChanged: () => void;
}

const ICON: Record<DocCheck['status'], { icon: React.ElementType; color: string }> = {
  pass: { icon: CheckCircle2, color: 'text-green' },
  warn: { icon: AlertTriangle, color: 'text-saffron-600' },
  fail: { icon: XCircle, color: 'text-coral-600' },
};

/**
 * The applicant's passport-size photo. One photo is used for every application and printed
 * in the photo box of each form; it is checked for a single, clear, front-facing face.
 */
export const PhotoCard = React.forwardRef<HTMLElement, Props>(({ photo, onSession, onChanged }, ref) => {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current: string | null = null;
    if (photo) {
      autofillApi.photoBlob().then((b) => {
        if (b) setUrl((current = URL.createObjectURL(b)));
      });
    } else setUrl(null);
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, [photo?.uploadedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onSession(await autofillApi.uploadPhoto(await preparePassportPhoto(file)));
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'The photo could not be added.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    onSession(await autofillApi.deletePhoto());
    onChanged();
  };

  const order = { fail: 0, warn: 1, pass: 2 };
  const checks = [...(photo?.checks || [])].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <section ref={ref} className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby="photo-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="photo-h" className="text-lg font-bold text-navy">Your photo</h2>
        {busy ? (
          <StatusPill tone="info">Checking…</StatusPill>
        ) : !photo ? (
          <StatusPill tone="warning">Required</StatusPill>
        ) : photo.usable ? (
          <StatusPill tone={checks.some((c) => c.status === 'warn') ? 'warning' : 'success'}>{checks.some((c) => c.status === 'warn') ? 'Added — check' : 'Added'}</StatusPill>
        ) : (
          <StatusPill tone="danger">Can’t use</StatusPill>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Every form needs a recent passport-size photo. Add it once — it is printed on all your applications.</p>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row">
        <div className="relative grid aspect-[35/45] w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-navy-50">
          {url ? <img src={url} alt="Your passport-size photo" className="h-full w-full object-cover" /> : <UserRound className="h-12 w-12 text-slate-300" aria-hidden />}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <Spinner className="h-6 w-6 text-teal-600" label="Checking photo" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {checks.length > 0 ? (
            <ul className="space-y-1.5" aria-label="Photo checks">
              {checks.map((c) => {
                const m = ICON[c.status];
                return (
                  <li key={c.id} className="flex items-start gap-2 text-sm">
                    <m.icon className={`mt-0.5 h-4 w-4 shrink-0 ${m.color}`} aria-hidden />
                    <span>
                      <span className="font-semibold text-navy">{c.label}</span>
                      {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-1 text-sm text-muted">
              <li>• Face the camera, eyes open, no dark glasses or cap</li>
              <li>• Plain white or light background, even light</li>
              <li>• Only you in the photo, head and shoulders</li>
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy} className="btn btn-primary">
              <Camera className="h-4 w-4" aria-hidden /> {photo ? 'Retake' : 'Take photo'}
            </button>
            <button type="button" onClick={() => pickRef.current?.click()} disabled={busy} className="btn btn-outline">
              <ImagePlus className="h-4 w-4" aria-hidden /> Upload photo
            </button>
            {photo && (
              <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost text-muted">
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </button>
            )}
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => upload(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          <input ref={pickRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => upload(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          {error && <Alert tone="danger" className="mt-3" title={error} />}
          <p className="mt-3 text-xs text-muted">It is cropped to 35 × 45 mm. Unlike your documents, the photo is kept (encrypted) so it can be printed on your forms, and is deleted with the rest of your data.</p>
        </div>
      </div>
    </section>
  );
});
PhotoCard.displayName = 'PhotoCard';
