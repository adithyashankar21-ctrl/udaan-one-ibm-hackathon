import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadFile } from '../../services/autofillApi';

const MAX_SIDE = 2200;
const MAX_BYTES = 10 * 1024 * 1024;

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const canvasToJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.86));

/**
 * Prepare a picked file for upload: photos are turned upright (EXIF), scaled down and
 * re-encoded as JPEG (smaller, and strips location metadata). PDFs are sent as they are.
 */
export async function prepareFile(file: File): Promise<UploadFile> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
    return { name: file.name, mimeType: 'application/pdf', dataBase64: await toBase64(file) };
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await canvasToJpeg(canvas);
    return { name: file.name.replace(/\.\w+$/, '') + '.jpg', mimeType: 'image/jpeg', dataBase64: await toBase64(blob) };
  } catch {
    // The browser cannot decode it (for example HEIC on Chrome) — send the original.
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
    return { name: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: await toBase64(file) };
  }
}

/** Encode a captured camera frame, applying the chosen rotation (degrees clockwise). */
export async function canvasToUpload(source: HTMLCanvasElement, rotation: number, name: string): Promise<UploadFile> {
  const turn = ((rotation % 360) + 360) % 360;
  const out = document.createElement('canvas');
  const sideways = turn === 90 || turn === 270;
  out.width = sideways ? source.height : source.width;
  out.height = sideways ? source.width : source.height;
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return { name, mimeType: 'image/jpeg', dataBase64: await toBase64(await canvasToJpeg(out)) };
}

/** Browser speech-to-text for answering questions by voice (no Gemini quota used). */
export function useDictation(locale: string, onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const cbRef = useRef(onText);
  cbRef.current = onText;
  const Ctor = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0]?.transcript || '').join(' ').trim();
      if (text) cbRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [Ctor, locale]);

  useEffect(() => stop, [stop]);
  return { supported: Boolean(Ctor), listening, start, stop };
}
