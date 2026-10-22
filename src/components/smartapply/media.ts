import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadFile } from '../../services/autofillApi';
import { pickVoice } from '../learning/useSpeaker';
import { aiService, speakWithBackupVoice } from '../../services/aiService';

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
const words = (list: string, anchored = false) => new RegExp(`${anchored ? '^' : '(?:^|[\\s,.!?।۔،؟])'}(?:${list})(?=$|[\\s,.!?।۔،؟])`, 'i');
/**
 * Spoken commands in every supported language (English words too: people often say "scan" or
 * "done" in English whatever language they speak). Order: en/Hinglish, hi, mr, ta, te, kn, ml,
 * bn, gu, pa, or, ur.
 */
const VOCAB = {
  stop: 'stop|exit|cancel|band karo|bas|ruko|रुको|बंद करो|बस|थांबा|थांब|நிறுத்து|நிறுத்துங்கள்|போதும்|ఆపు|ఆపండి|చాలు|ನಿಲ್ಲಿಸು|ನಿಲ್ಲಿಸಿ|ಸಾಕು|നിർത്തൂ|നിർത്തുക|മതി|থামো|থামুন|বন্ধ করো|বন্ধ|બંધ કરો|બંધ|રોકો|બસ|ਰੁਕੋ|ਬੰਦ ਕਰੋ|ਬੱਸ|ବନ୍ଦ କର|ବନ୍ଦ|ରୁହ|ରୁକ|رکو|بس|بند کرو',
  skip: 'skip|next|chhodo|chodo|aage|बाद में|छोड़ो|छोड़ दो|अगला|पुढे|सोडा|वगळा|அடுத்து|அடுத்தது|தவிர்|విడిచిపెట్టు|తర్వాత|తరువాత|వదిలేయి|ಮುಂದೆ|ಬಿಡು|ಮುಂದಿನದು|അടുത്തത്|ഒഴിവാക്കൂ|বাদ দাও|বাদ দিন|পরের|પછી|છોડો|આગળ|ਛੱਡੋ|ਅੱਗੇ|ଛାଡ|ଆଗକୁ|ପରବର୍ତ୍ତୀ|چھوڑو|آگے|اگلا',
  repeat: 'repeat|again|dobara|phir se|what|दोबारा|फिर से|पुन्हा|परत|மீண்டும்|திரும்ப|మళ్ళీ|మళ్లీ|ಮತ್ತೆ|ಇನ್ನೊಮ್ಮೆ|വീണ്ടും|আবার|ফের|ફરીથી|ફરી|ਦੁਬਾਰਾ|ਫਿਰ ਤੋਂ|ପୁଣି|ଆଉଥରେ|دوبارہ|پھر سے',
  scan: 'scan|camera|upload|document|kagaz|kaagaz|स्कैन|कैमरा|दस्तावेज़|दस्तावेज|स्कॅन|कॅमेरा|ஸ்கேன்|கேமரா|స్కాన్|కెమెరా|ಸ್ಕ್ಯಾನ್|ಕ್ಯಾಮೆರಾ|സ്കാൻ|ക്യാമറ|স্ক্যান|ক্যামেরা|સ્કેન|કેમેરા|ਸਕੈਨ|ਕੈਮਰਾ|ସ୍କାନ|କ୍ୟାମେରା|اسکین|کیمرہ|کیمرا',
  capture: 'capture|click|take|photo lo|khicho|kheencho|खींचो|कैप्चर|क्लिक|काढा|कॅप्चर|கேப்சர்|எடு|క్యాప్చర్|తీయి|ಕ್ಯಾಪ್ಚರ್|ತೆಗೆ|ക്യാപ്ചർ|എടുക്കൂ|ক্যাপচার|তোলো|કેપ્ચર|લો|ਕੈਪਚਰ|ਖਿੱਚੋ|କ୍ୟାପଚର|ଉଠାଅ|کیپچر|کھینچو',
  done: 'done|finish|ho gaya|hogaya|हो गया|पूरा|झाले|झालं|पूर्ण|முடிந்தது|ஆச்சு|அயிந்தது|అయిపోయింది|అయింది|పూర్తి|ಆಯಿತು|ಮುಗಿಯಿತು|കഴിഞ്ഞു|തീർന്നു|হয়ে গেছে|শেষ|થઈ ગયું|પૂરું|ਹੋ ਗਿਆ|ਪੂਰਾ|ହୋଇଗଲା|ସରିଲା|ہو گیا|مکمل',
  answer: 'answer|jawab|bata|myself|khud|जवाब|बता|ख़ुद|खुद|उत्तर|सांगतो|சொல்கிறேன்|பதில்|చెప్తాను|జవాబు|ಹೇಳುತ್ತೇನೆ|ಉತ್ತರ|പറയാം|ഉത്തരം|উত্তর|বলব|જવાબ|કહીશ|ਜਵਾਬ|ਦੱਸਾਂਗਾ|ଉତ୍ତର|କହିବି|جواب|بتاؤں',
  photo: 'photo|foto|selfie|फ़ोटो|फोटो|ஃபோட்டோ|புகைப்படம்|ఫోటో|ಫೋಟೋ|ഫോട്ടോ|ফটো|ছবি|ફોટો|ਫੋਟੋ|ଫଟୋ|فوٹو|تصویر',
  read: 'read|padh|padho|suna|sunao|पढ़|सुना|वाचा|ऐकवा|படி|படிக்கவும்|சொல்லுங்கள்|చదువు|చదవండి|ಓದು|ಓದಿ|വായിക്കൂ|পড়ো|পড়ুন|વાંચો|ਪੜ੍ਹੋ|ପଢ|پڑھو|سناؤ',
  approve: 'approve|correct|sahi|theek|thik|manzoor|मंज़ूर|मंजूर|सही|ठीक|बरोबर|मान्य|ஒப்புதல்|சரி|ఆమోదం|సరి|సరే|ಅನುಮೋದನೆ|ಸರಿ|അംഗീകരിക്കൂ|ശരി|অনুমোদন|ঠিক আছে|ঠিক|મંજૂર|બરાબર|ਮਨਜ਼ੂਰ|ਠੀਕ|ଅନୁମୋଦନ|ଠିକ|منظور|صحیح|ٹھیک',
  download: 'download|save|डाउनलोड|सेव|डाउनलोड करा|டவுன்லோட்|பதிவிறக்கு|డౌన్‌లోడ్|ಡೌನ್‌ಲೋಡ್|ഡൗൺലോഡ്|ডাউনলোড|ડાઉનલોડ|ਡਾਊਨਲੋਡ|ଡାଉନଲୋଡ|ڈاؤن لوڈ',
  agree: 'agree|i agree|sahmat|सहमत|मान्य|ஒப்புக்கொள்கிறேன்|சம்மதம்|అంగీకరిస్తున్నాను|ಒಪ್ಪುತ್ತೇನೆ|സമ്മതം|রাজি|সম্মত|સંમત|ਸਹਿਮਤ|ରାଜି|ସହମତ|متفق|راضی',
  yes: 'yes|yeah|yep|ok|okay|haan|han|ha|hanji|ji|हाँ|हां|हा|जी|होय|हो|ஆம்|ஆமா|சரி|అవును|ಹೌದು|അതെ|ഉവ്വ്|হ্যাঁ|হাঁ|হ্যা|હા|ਹਾਂ|ਹਾਂਜੀ|ହଁ|ହଁ|ہاں|جی',
  no: 'no|nope|nahi|nahin|not|नहीं|नही|ना|नाही|இல்லை|வேண்டாம்|లేదు|వద్దు|ಇಲ್ಲ|ಬೇಡ|ഇല്ല|വേണ്ട|না|নেই|ના|નહીં|ਨਹੀਂ|ନା|ନାହିଁ|نہیں|نا',
};

export const VOICE_COMMANDS = {
  stop: words(VOCAB.stop, true),
  skip: words(VOCAB.skip, true),
  repeat: words(VOCAB.repeat, true),
  scan: words(VOCAB.scan),
  capture: words(VOCAB.capture),
  done: words(VOCAB.done),
  answer: words(VOCAB.answer),
  photo: words(VOCAB.photo),
  read: words(VOCAB.read),
  approve: words(VOCAB.approve),
  download: words(VOCAB.download),
  agree: words(VOCAB.agree),
  yes: words(VOCAB.yes),
  no: words(VOCAB.no),
};
