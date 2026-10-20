import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadFile } from '../../services/autofillApi';
import { pickVoice } from '../learning/useSpeaker';

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

/**
 * Turn a picked or captured photo into a passport-size (35 × 45 mm) JPEG: upright, cropped to
 * that shape around the centre (keeping more above the face than below), 420 × 540 px.
 */
export async function preparePassportPhoto(file: File): Promise<UploadFile> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    throw new Error('This photo format cannot be opened here. Please use a JPG or PNG photo.');
  }
  const target = 35 / 45;
  let sw = bitmap.width;
  let sh = bitmap.height;
  if (sw / sh > target) sw = sh * target;
  else sh = sw / target;
  const sx = (bitmap.width - sw) / 2;
  // Portrait selfies have the face in the upper part — crop more from the bottom
  const sy = Math.max(0, Math.min(bitmap.height - sh, (bitmap.height - sh) * 0.35));
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 540;
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { name: 'photo.jpg', mimeType: 'image/jpeg', dataBase64: await toBase64(await canvasToJpeg(canvas)) };
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

/**
 * Turn-taking voice helper for filling forms hands-free: `say` speaks a prompt with the
 * browser's own voice (instant, no network) and resolves when it has finished; `listen`
 * hears one answer, showing words live as they are recognised. Both are cancelled by `cancel`.
 */
export function useVoiceTurns(locale: string) {
  const Rec = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [interim, setInterim] = useState('');
  const [phase, setPhase] = useState<'idle' | 'speaking' | 'listening'>('idle');
  const recRef = useRef<any>(null);
  const run = useRef(0);

  const cancel = useCallback(() => {
    run.current++;
    if (canSpeak) window.speechSynthesis.cancel();
    try {
      recRef.current?.abort();
    } catch {}
    recRef.current = null;
    setInterim('');
    setPhase('idle');
  }, [canSpeak]);

  const say = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        const mine = ++run.current;
        if (!canSpeak || !text) return resolve(true);
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(locale);
        u.lang = voice?.lang || locale;
        if (voice) u.voice = voice;
        u.rate = 1.05;
        const done = () => {
          if (run.current === mine) setPhase('idle');
          resolve(run.current === mine);
        };
        u.onend = done;
        u.onerror = done;
        setPhase('speaking');
        window.speechSynthesis.speak(u);
        // Some browsers never fire onend for long text; do not hang the conversation
        setTimeout(done, 1500 + text.length * 90);
      }),
    [canSpeak, locale]
  );

  /** Resolves with what was said, '' if nothing was heard in time, or null if cancelled. */
  const listen = useCallback(
    (timeoutMs = 9000) =>
      new Promise<string | null>((resolve) => {
        const mine = ++run.current;
        if (!Rec) return resolve(null);
        const rec = new Rec();
        rec.lang = locale;
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        let final = '';
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try {
            rec.abort();
          } catch {}
          if (recRef.current === rec) recRef.current = null;
          setInterim('');
          if (run.current === mine) setPhase('idle');
          resolve(run.current === mine ? value : null);
        };
        const timer = setTimeout(() => finish(final.trim()), timeoutMs);
        rec.onresult = (e: any) => {
          let live = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) final += r[0].transcript + ' ';
            else live += r[0].transcript;
          }
          setInterim((final + live).trim());
          // Answer as soon as the browser marks the phrase final — no extra waiting
          if (final.trim() && !live) finish(final.trim());
        };
        rec.onerror = (e: any) => finish(e?.error === 'no-speech' ? '' : final.trim());
        rec.onend = () => finish(final.trim());
        recRef.current = rec;
        setPhase('listening');
        try {
          rec.start();
        } catch {
          finish('');
        }
      }),
    [Rec, locale]
  );

  useEffect(() => cancel, [cancel]);
  return { supported: Boolean(Rec), canSpeak, say, listen, cancel, interim, phase };
}

/** Words that control a voice conversation, in English, Hinglish and Hindi. */
// \b does not work next to Indian scripts, so word edges are spaces or punctuation
const words = (list: string, anchored = false) => new RegExp(`${anchored ? '^' : '(?:^|[\\s,.!?।])'}(?:${list})(?=$|[\\s,.!?।])`, 'i');
export const VOICE_COMMANDS = {
  stop: words('stop|band karo|bas|ruko|रुको|बंद करो|बस', true),
  skip: words('skip|next|chhodo|chodo|aage|बाद में|छोड़ो|छोड़ दो|अगला', true),
  repeat: words('repeat|again|dobara|phir se|दोबारा|फिर से|what', true),
  scan: words('scan|camera|upload|document|kagaz|kaagaz|स्कैन|कैमरा|दस्तावेज़|दस्तावेज'),
  capture: words('capture|click|take|photo lo|khicho|kheencho|खींचो|कैप्चर|क्लिक'),
  done: words('done|finish|ho gaya|hogaya|हो गया|पूरा'),
};
