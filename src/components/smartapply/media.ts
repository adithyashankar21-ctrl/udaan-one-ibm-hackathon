import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadFile } from '../../services/autofillApi';
import { pickVoice } from '../learning/useSpeaker';
import { aiService, speakWithBackupVoice } from '../../services/aiService';
import { rememberHeard } from '../../services/heard';

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

/**
 * Joins the recogniser's results into one transcript, with up to 3 alternative readings of the
 * whole answer (each built by swapping in the second or third guess for one phrase).
 */
function collect(results: ArrayLike<any>, from = 0) {
  const finals: any[] = [];
  let live = '';
  for (let i = from; i < results.length; i++) {
    const r = results[i];
    if (r.isFinal) finals.push(r);
    else live += r[0]?.transcript || '';
  }
  const best = finals.map((r) => r[0]?.transcript || '').join(' ').replace(/\s+/g, ' ').trim();
  const alternatives: string[] = [];
  finals.forEach((r, i) => {
    for (let k = 1; k < Math.min(r.length, 4); k++) {
      const alt = finals.map((f, j) => (j === i ? r[k]?.transcript : f[0]?.transcript) || '').join(' ').replace(/\s+/g, ' ').trim();
      if (alt && alt !== best && !alternatives.includes(alt)) alternatives.push(alt);
    }
  });
  const scores = finals.map((r) => r[0]?.confidence).filter((c) => typeof c === 'number' && c > 0);
  const confidence = scores.length ? Math.min(...scores) : undefined;
  return { best, live: live.trim(), alternatives: alternatives.slice(0, 3), confidence };
}

/** Silence after speech that ends an answer — long enough for a pause between "my name is…" and the name. */
const END_OF_ANSWER_MS = 1200;

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
    // Keep listening through short pauses; the answer ends after a moment of silence
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 4;
    let heard = { best: '', live: '', alternatives: [] as string[], confidence: undefined as number | undefined };
    let quiet: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const send = () => {
      if (sent) return;
      sent = true;
      clearTimeout(quiet);
      try {
        rec.stop();
      } catch {}
      const text = (heard.best || heard.live).trim();
      if (!text) return;
      rememberHeard(text, heard.alternatives, heard.confidence);
      cbRef.current(text);
    };
    rec.onresult = (e: any) => {
      heard = collect(e.results);
      clearTimeout(quiet);
      quiet = setTimeout(send, heard.live ? END_OF_ANSWER_MS * 2 : END_OF_ANSWER_MS);
    };
    rec.onend = () => {
      send();
      setListening(false);
    };
    rec.onerror = () => {
      send();
      setListening(false);
    };
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
    aiService.stopAudio();
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
        const voice = pickVoice(locale);
        // No device voice for this language: use the backup voice instead of an English one
        if (!voice && !locale.startsWith('en')) {
          setPhase('speaking');
          speakWithBackupVoice(text, locale).then((ok) => {
            if (ok || run.current !== mine) {
              if (run.current === mine) setPhase('idle');
              return resolve(run.current === mine);
            }
            speakDevice();
          });
          return;
        }
        speakDevice();
        function speakDevice() {
        const u = new SpeechSynthesisUtterance(text);
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
        }
      }),
    [canSpeak, locale]
  );

  /**
   * Resolves with what was said, '' if nothing was heard in time, or null if cancelled.
   * `timeoutMs` is how long to wait for the person to start; once they speak, listening goes on
   * through short pauses and ends after a moment of silence (or after 30 seconds).
   */
  const listen = useCallback(
    (timeoutMs = 9000) =>
      new Promise<string | null>((resolve) => {
        const mine = ++run.current;
        if (!Rec) return resolve(null);
        const rec = new Rec();
        rec.lang = locale;
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 4;
        let heard = { best: '', live: '', alternatives: [] as string[], confidence: undefined as number | undefined };
        let settled = false;
        let quiet: ReturnType<typeof setTimeout> | undefined;
        const said = () => (heard.best || heard.live).trim();
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          clearTimeout(quiet);
          clearTimeout(longest);
          try {
            rec.abort();
          } catch {}
          if (recRef.current === rec) recRef.current = null;
          setInterim('');
          if (run.current === mine) setPhase('idle');
          if (value) rememberHeard(value, heard.alternatives, heard.confidence);
          resolve(run.current === mine ? value : null);
        };
        // Nothing said at all in time
        const timer = setTimeout(() => finish(said()), timeoutMs);
        const longest = setTimeout(() => finish(said()), 30000);
        rec.onresult = (e: any) => {
          heard = collect(e.results);
          setInterim([heard.best, heard.live].filter(Boolean).join(' '));
          // They are speaking: stop the start timer and end the answer after a pause instead
          clearTimeout(timer);
          clearTimeout(quiet);
          quiet = setTimeout(() => finish(said()), heard.live ? END_OF_ANSWER_MS * 2 : END_OF_ANSWER_MS);
        };
        rec.onerror = (e: any) => finish(e?.error === 'no-speech' ? '' : said());
        rec.onend = () => finish(said());
        recRef.current = rec;
        setPhase('listening');
        // A short gap after the app has spoken, so the end of its own voice is not heard as the answer
        setTimeout(() => {
          if (settled) return;
          try {
            rec.start();
          } catch {
            finish('');
          }
        }, 250);
      }),
    [Rec, locale]
  );

  useEffect(() => cancel, [cancel]);
  return { supported: Boolean(Rec), canSpeak, say, listen, cancel, interim, phase };
}

/** Words that control a voice conversation, in English, Hinglish and Hindi. */
// \b does not work next to Indian scripts, so word edges are spaces or punctuation
// Spoken commands, choices and field names live in data/voiceWords so the phone helpline can use them too
export { VOICE_COMMANDS, findField, spokenIndex, spokenYesNo } from '../../data/voiceWords';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A stored value as it should be read aloud: "15/08/1990" → "15 August 1990", digits one by one. */
export function speakable(value: string, type: string): string {
  const date = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (date) return `${Number(date[1])} ${MONTH_NAMES[Number(date[2]) - 1] || date[2]} ${date[3]}`;
  if (['mobile', 'pincode', 'account'].includes(type)) return value.split('').join(' ');
  if (type === 'money' && /^\d+$/.test(value)) return `₹${Number(value).toLocaleString('en-IN')}`;
  return value;
}
