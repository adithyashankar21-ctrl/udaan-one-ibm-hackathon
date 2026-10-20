import React, { useEffect, useRef, useState } from 'react';
import { AudioLines, Camera, Check, RotateCw, Trash2, X } from 'lucide-react';
import type { UploadFile } from '../../services/autofillApi';
import { VOICE_COMMANDS, canvasToUpload, useVoiceTurns } from './media';

interface Page {
  id: number;
  canvas: HTMLCanvasElement;
  preview: string;
  rotation: number;
}

interface Props {
  onDone: (files: UploadFile[]) => void;
  onClose: () => void;
  /** 'user' opens the front camera (for the applicant's own photo). */
  facing?: 'user' | 'environment';
  title?: string;
  /** Spoken guidance; when set together with speechLocale, "capture" and "done" work by voice. */
  voicePrompt?: string;
  speechLocale?: string;
  /** Finish automatically after this many pictures (1 for a photo). */
  maxPages?: number;
}

/** Multi-page document scanner using the device camera. Falls back to the phone's camera app. */
export const CameraScanner: React.FC<Props> = ({ onDone, onClose, facing = 'environment', title = 'Scan document', voicePrompt, speechLocale, maxPages }) => {
  const voice = useVoiceTurns(speechLocale || 'en-IN');
  const voiceOn = Boolean(voicePrompt && speechLocale && voice.supported);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera here. Use "Take photo" instead.');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setError('Camera permission was not given. You can use "Take photo" or upload files instead.'));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const pagesRef = useRef<Page[]>([]);
  pagesRef.current = pages;

  const finish = async (list = pagesRef.current) => {
    if (!list.length) return;
    setBusy(true);
    voice.cancel();
    try {
      const files = await Promise.all(list.map((p, i) => canvasToUpload(p.canvas, p.rotation, `scan-page-${i + 1}.jpg`)));
      onDone(files);
    } finally {
      setBusy(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return false;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    if (facing === 'user') {
      // The front camera preview is mirrored; save the photo the right way round
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const page = { id: Date.now(), canvas, preview: canvas.toDataURL('image/jpeg', 0.5), rotation: 0 };
    const next = [...pagesRef.current, page];
    pagesRef.current = next;
    setPages(next);
    if (maxPages && next.length >= maxPages) finish(next);
    return true;
  };

  // Hands-free: say "capture" for each page, then "done"
  useEffect(() => {
    if (!voiceOn) return;
    let alive = true;
    (async () => {
      let prompt = voicePrompt!;
      while (alive) {
        if (prompt && !(await voice.say(prompt))) return;
        prompt = '';
        const heard = await voice.listen(15000);
        if (heard === null || !alive) return;
        if (!heard) continue;
        if (VOICE_COMMANDS.stop.test(heard)) return onClose();
        if (VOICE_COMMANDS.done.test(heard) && pagesRef.current.length) return finish();
        if (VOICE_COMMANDS.capture.test(heard)) {
          if (!capture()) prompt = 'The camera is not ready yet.';
          else if (!maxPages || pagesRef.current.length < maxPages) prompt = `Page ${pagesRef.current.length} taken. Say capture for another page, or done.`;
          else return;
        }
      }
    })();
    return () => {
      alive = false;
      voice.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);

  const onFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of list) {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      setPages((p) => [...p, { id: Date.now() + Math.random(), canvas, preview: canvas.toDataURL('image/jpeg', 0.5), rotation: 0 }]);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan document" className="fixed inset-0 z-50 flex flex-col bg-navy text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-bold">
          {title}
          {maxPages === 1 ? '' : ` · ${pages.length} page${pages.length === 1 ? '' : 's'}`}
        </p>
        {voiceOn && (
          <span className="ml-auto mr-3 inline-flex min-w-0 items-center gap-2 text-sm text-teal" role="status">
            <AudioLines className={`h-4 w-4 shrink-0 ${voice.phase === 'listening' ? 'animate-pulse text-coral' : ''}`} aria-hidden />
            <span className="truncate">{voice.interim ? `“${voice.interim}”` : voice.phase === 'listening' ? 'Say “capture” or “done”' : 'Voice on'}</span>
          </span>
        )}
        <button onClick={onClose} aria-label="Close scanner" className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        {error ? (
          <div className="grid h-full place-items-center p-6 text-center">
            <p className="max-w-sm text-sm text-slate-300">{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className={`h-full w-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`} />
            {facing === 'user' ? (
              <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-[35/45] h-4/5 -translate-x-1/2 -translate-y-1/2 rounded-[45%] border-2 border-dashed border-saffron/70" aria-hidden />
            ) : (
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-saffron/70" aria-hidden />
            )}
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-slate-300">
              {facing === 'user' ? 'Face inside the oval, looking straight, plain wall behind you.' : 'Fit the whole page inside the frame, in good light, without glare.'}
            </p>
          </>
        )}
      </div>

      {pages.length > 0 && (
        <ul className="flex gap-3 overflow-x-auto bg-navy-800 px-4 py-3" aria-label="Captured pages">
          {pages.map((p, i) => (
            <li key={p.id} className="relative shrink-0">
              <img src={p.preview} alt={`Page ${i + 1}`} style={{ transform: `rotate(${p.rotation}deg)` }} className="h-20 w-16 rounded-lg object-cover transition-transform" />
              <div className="mt-1 flex justify-center gap-1">
                <button
                  onClick={() => setPages((all) => all.map((x) => (x.id === p.id ? { ...x, rotation: x.rotation + 90 } : x)))}
                  aria-label={`Rotate page ${i + 1}`}
                  className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button onClick={() => setPages((all) => all.filter((x) => x.id !== p.id))} aria-label={`Remove page ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 hover:bg-white/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <button onClick={() => fallbackRef.current?.click()} className="h-12 rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/10">
          Take photo
        </button>
        <input ref={fallbackRef} type="file" accept="image/*" capture={facing} multiple={maxPages !== 1} className="hidden" onChange={onFallback} />
        {!error && (
          <button onClick={capture} aria-label="Capture page" className="grid h-16 w-16 place-items-center rounded-full bg-saffron text-navy shadow-lift hover:bg-saffron-600">
            <Camera className="h-7 w-7" />
          </button>
        )}
        <button
          onClick={() => finish()}
          disabled={pages.length === 0 || busy}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-green px-4 text-sm font-bold disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> Use {pages.length || ''} page{pages.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
};
