import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, RotateCw, Trash2, X } from 'lucide-react';
import type { UploadFile } from '../../services/autofillApi';
import { canvasToUpload } from './media';

interface Page {
  id: number;
  canvas: HTMLCanvasElement;
  preview: string;
  rotation: number;
}

interface Props {
  onDone: (files: UploadFile[]) => void;
  onClose: () => void;
}

/** Multi-page document scanner using the device camera. Falls back to the phone's camera app. */
export const CameraScanner: React.FC<Props> = ({ onDone, onClose }) => {
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
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
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

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setPages((p) => [...p, { id: Date.now(), canvas, preview: canvas.toDataURL('image/jpeg', 0.5), rotation: 0 }]);
  };

  const finish = async () => {
    setBusy(true);
    try {
      const files = await Promise.all(pages.map((p, i) => canvasToUpload(p.canvas, p.rotation, `scan-page-${i + 1}.jpg`)));
      onDone(files);
    } finally {
      setBusy(false);
    }
  };

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
        <p className="font-bold">Scan document · {pages.length} page{pages.length === 1 ? '' : 's'}</p>
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
            <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-saffron/70" aria-hidden />
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-slate-300">Fit the whole page inside the frame, in good light, without glare.</p>
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
        <input ref={fallbackRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onFallback} />
        {!error && (
          <button onClick={capture} aria-label="Capture page" className="grid h-16 w-16 place-items-center rounded-full bg-saffron text-navy shadow-lift hover:bg-saffron-600">
            <Camera className="h-7 w-7" />
          </button>
        )}
        <button
          onClick={finish}
          disabled={pages.length === 0 || busy}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-green px-4 text-sm font-bold disabled:opacity-40"
        >
          <Check className="h-4 w-4" /> Use {pages.length || ''} page{pages.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
};
