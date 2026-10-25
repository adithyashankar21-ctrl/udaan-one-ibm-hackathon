import { BeneficiaryProfile, ChatMessage, LivelihoodAnalysis } from '../types';
import { announceApplyIntent } from './autofillApi';
import { announceLearnIntent } from './learnApi';
import { announceRoadmapIntent } from './roadmaps';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { LANGUAGE_NAMES, offlineReply, scriptLanguage, toLanguageCode } from '../data/languageTools';

let currentAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let cachedSingleNaturalVoice: SpeechSynthesisVoice | null = null;

// Initialize speech synthesis voices eagerly
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
    cachedSingleNaturalVoice = null; // Re-evaluate on update
  };
}

async function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const immediate = window.speechSynthesis.getVoices();
  if (immediate && immediate.length > 0) return immediate;

  return new Promise((resolve) => {
    let timer: any;
    const handleVoices = () => {
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoices);
    timer = setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoices);
      resolve(window.speechSynthesis.getVoices() || []);
    }, 250);
  });
}

// In-memory audio cache on client for instant playback
const clientAudioCache = new Map<string, { audioBase64: string; mimeType: string; engine: string }>();

// Clean text for natural speech (strips markdown asterisks, hashes, brackets, etc.)
function prepareTextForSpeech(text: string): string {
  return text
    .replace(/[*#_~`]+/g, ' ')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/[•\-\+]\s+/g, ', ')
    .replace(/PM-AJAY/gi, 'PM Ajay')
    .replace(/₹\s*([0-9,]+)/g, '$1 rupees')
    .replace(/\s+/g, ' ')
    .trim();
}

// Select a natural, human-like voice strictly matched to the requested language or script
function getVoiceForLanguageOrText(locale: string = 'en-IN', text: string = '', customVoices?: SpeechSynthesisVoice[]): { voice: SpeechSynthesisVoice | null; targetLocale: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return { voice: null, targetLocale: locale };
  }
  const voices = customVoices && customVoices.length > 0 ? customVoices : (cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices());

  // The language follows the text's script, else the requested locale
  const targetPrefix = scriptLanguage(text, toLanguageCode(locale));
  const targetLocale = targetPrefix === 'en' ? 'en-IN' : SUPPORTED_LANGUAGES.find((l) => l.code === targetPrefix)?.speechLocale || locale;

  if (!voices || voices.length === 0) {
    return { voice: null, targetLocale };
  }

  // 1. Regional Indian language: ONLY match voices dedicated to that language
  if (targetPrefix !== 'en') {
    // Search priority: Microsoft Natural / Google Neural / language-specific
    const matchedVoice = voices.find((v) => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      const vName = v.name.toLowerCase();
      return (
        vLang.startsWith(targetPrefix) ||
        (targetPrefix === 'ta' && (vName.includes('tamil') || vName.includes('valluvar') || vName.includes('kavya'))) ||
        (targetPrefix === 'hi' && (vName.includes('hindi') || vName.includes('swara') || vName.includes('madhur') || vName.includes('kalpana'))) ||
        (targetPrefix === 'te' && (vName.includes('telugu') || vName.includes('mohan') || vName.includes('chitra'))) ||
        (targetPrefix === 'kn' && (vName.includes('kannada') || vName.includes('gagan') || vName.includes('sapna'))) ||
        (targetPrefix === 'ml' && (vName.includes('malayalam') || vName.includes('sobhana') || vName.includes('midhun'))) ||
        vName.includes(LANGUAGE_NAMES[targetPrefix].toLowerCase())
      );
    });

    // If native voice found, use it; otherwise return NULL voice and let browser use targetLocale phonetic engine
    // CRITICAL: NEVER assign an English voice to Tamil/Hindi/Telugu text
    return { voice: matchedVoice || null, targetLocale };
  }

  // 2. English: Priority to warm, natural Indian English / Natural voices
  const indianNatural = voices.find(
    (v) =>
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Online') || v.name.includes('Google')) &&
      (v.lang.toLowerCase().includes('en-in') || v.name.toLowerCase().includes('india') || v.name.includes('Neerja') || v.name.includes('Prabhat'))
  );
  if (indianNatural) return { voice: indianNatural, targetLocale: 'en-IN' };

  const naturalEn = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google UK English Female') || v.name.includes('Online'))
  );
  if (naturalEn) return { voice: naturalEn, targetLocale: 'en-IN' };

  const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  return { voice: anyEn || null, targetLocale: 'en-IN' };
}

// Incremented on every stop so an in-progress multi-sentence playback can bail out
let speechSession = 0;
// True while the user has paused playback (so the pause is not treated as a stop)
let userPaused = false;

// Studio voice persona matched to language (kept identical across all sentences of a reply)
function getStudioVoiceName(locale: string): string {
  if (locale.startsWith('hi') || locale.startsWith('te')) return 'Aoede';
  return 'Kore';
}

// Split speech into as few pieces as possible: a normal reply is synthesized in one
// request so it is spoken in one continuous voice (and uses a single TTS quota request).
// Only very long text is split, and every piece is then locked to the same engine.
function splitForSpeech(text: string, firstLen: number = 1800, restLen: number = 1800): string[] {
  const sentences = text.match(/[^.!?।॥\n]+(?:[.!?।॥]+|$)/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  const chunks: string[] = [];
  let current = '';

  const limit = () => (chunks.length === 0 ? firstLen : restLen);

  const pushLong = (s: string) => {
    // Break an over-long sentence on commas, then on spaces
    const parts = s.split(/(?<=[,;:])\s+/);
    let buf = '';
    for (const part of parts) {
      if (part.length > limit()) {
        if (buf) { chunks.push(buf); buf = ''; }
        let words = '';
        for (const w of part.split(/\s+/)) {
          if ((words + ' ' + w).trim().length > limit() && words) { chunks.push(words); words = w; }
          else words = (words + ' ' + w).trim();
        }
        if (words) chunks.push(words);
      } else if ((buf + ' ' + part).trim().length > limit()) {
        chunks.push(buf);
        buf = part;
      } else {
        buf = (buf + ' ' + part).trim();
      }
    }
    if (buf) chunks.push(buf);
  };

  for (const s of sentences) {
    if (s.length > limit()) {
      if (current) { chunks.push(current); current = ''; }
      pushLong(s);
    } else if ((current + ' ' + s).trim().length > limit()) {
      chunks.push(current);
      current = s;
    } else {
      current = (current + ' ' + s).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.length > 0);
}

type StudioAudio = { audioBase64: string; mimeType: string; engine: string };

// Fetch High-fidelity Neural Studio TTS via Gemini /api/ai/tts (client-cached).
// When `engine` is given, the server must use exactly that engine (same voice) or fail.
async function fetchStudioAudio(
  text: string,
  locale: string,
  voiceName: string,
  engine?: string
): Promise<StudioAudio | null> {
  const cacheKey = `${locale}:${voiceName}:${engine || '*'}:${text}`;
  const cached = clientAudioCache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale, voiceName, engine }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.audioBase64) return null;
    const entry: StudioAudio = {
      audioBase64: data.audioBase64,
      mimeType: data.mimeType || 'audio/wav',
      engine: data.engine || 'unknown',
    };
    clientAudioCache.set(cacheKey, entry);
    clientAudioCache.set(`${locale}:${voiceName}:${entry.engine}:${text}`, entry);
    return entry;
  } catch (e) {
    console.warn('Server TTS unavailable:', e);
    return null;
  }
}

// Saved Gemini recording for this exact text, if one exists (no quota used)
async function fetchCachedAudio(text: string, locale: string, voiceName: string): Promise<StudioAudio | null> {
  try {
    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, locale, voiceName, cacheOnly: true }),
    });
    if (response.status !== 200) return null;
    const data = await response.json();
    return data.audioBase64 ? { audioBase64: data.audioBase64, mimeType: data.mimeType || 'audio/wav', engine: data.engine } : null;
  } catch {
    return null;
  }
}

async function geminiVoiceAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/api/ai/tts/status');
    return r.ok ? Boolean((await r.json()).geminiAvailable) : true;
  } catch {
    return true;
  }
}

// Fetch a chunk locked to the reply's engine, retrying once instead of switching voices.
// The server already retries brief errors, so a longer client loop only adds silence.
async function fetchLockedAudio(text: string, locale: string, voiceName: string, engine: string): Promise<StudioAudio | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const audio = await fetchStudioAudio(text, locale, voiceName, engine);
    if (audio) return audio;
    if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

function playAudioData(data: { audioBase64: string; mimeType: string }): Promise<void> {
  return new Promise<void>((resolve) => {
    const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
    currentAudio = audio;
    let guard: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      clearTimeout(guard);
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    // Never let a stalled clip leave the conversation stuck in "speaking": give up if it does not
    // start within 6 s, or runs well past its own length
    guard = setTimeout(done, 6000);
    audio.onplaying = () => {
      clearTimeout(guard);
      const length = isFinite(audio.duration) ? audio.duration : 30;
      guard = setTimeout(done, (length - audio.currentTime) * 1000 + 2500);
    };
    audio.onended = done;
    audio.onerror = done;
    // Resolve if stopped externally (pause from stopAudio), but not on a user pause
    audio.onpause = () => { if (!audio.ended && !userPaused) done(); };
    audio.play().catch(done);
  });
}

// Ultra-fluent Web Speech API Fallback with strict language/voice matching
async function speakWithBrowserVoice(text: string, locale: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = await getVoicesAsync();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const { voice, targetLocale } = getVoiceForLanguageOrText(locale, text, voices);

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || targetLocale;
    } else {
      utterance.lang = targetLocale;
    }

    utterance.rate = 0.94; // Calm, respectful, natural cadence
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

export { offlineReply };

/** Whether this device has its own voice for the language of `locale`. */
export function hasDeviceVoice(locale: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  if (toLanguageCode(locale) === 'en') return true;
  return Boolean(getVoiceForLanguageOrText(locale, '', window.speechSynthesis.getVoices()).voice);
}

/**
 * Speak with the server's backup voice (no Gemini quota), for languages this device has no
 * voice for. Resolves false if it could not be played, so the caller can fall back.
 */
export async function speakWithBackupVoice(text: string, locale: string): Promise<boolean> {
  const pieces = splitForSpeech(prepareTextForSpeech(text), 160, 220);
  const session = speechSession;
  const pending = pieces.map((p) => fetchStudioAudio(p, locale, getStudioVoiceName(locale), 'google'));
  for (const next of pending) {
    const audio = await next;
    if (session !== speechSession) return true;
    if (!audio) return false;
    await playAudioData(audio);
    if (session !== speechSession) return true;
  }
  return true;
}

/** Whether the most recent chat reply came from the offline fallback (so the UI can offer a retry). */
export let lastChatMeta: { fallback: boolean; at: number } = { fallback: false, at: 0 };

const channelKind = (channel: string) =>
  /ivr|helpline|phone/i.test(channel) ? 'helpline' : /whatsapp|chat/i.test(channel) ? 'chat' : /kiosk/i.test(channel) ? 'kiosk' : 'voice';

export const aiService = {
  // Send message to conversational PM-AJAY counselor
  async chatWithAssistant(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    userProfile: BeneficiaryProfile,
    language: string,
    channel: string
  ): Promise<string> {
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          userProfile,
          language,
          channel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.fallback || errorData.error || 'Server error');
      }

      const data = await response.json();
      lastChatMeta = { fallback: Boolean(data.fallback), at: Date.now() };
      // Any channel that hears "I want to apply…" hands off to the shared Smart Apply workflow
      if (data.applyIntent) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content;
        announceApplyIntent({ schemeId: data.applyIntent.schemeId || null, channel: channelKind(channel), text: lastUser });
      }
      // "Make me a career roadmap…" / "how do I become…": the app makes the step-by-step roadmap
      if (data.roadmapIntent) {
        announceRoadmapIntent({ request: data.roadmapIntent.request || undefined, channel: channelKind(channel) });
      }
      // "Teach me…" requests: the assistant teaches in the conversation and offers the full course
      if (data.learnIntent) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content;
        announceLearnIntent({ courseId: data.learnIntent.courseId, topic: data.learnIntent.topic, question: lastUser, channel: channelKind(channel) });
      }
      return data.reply;
    } catch (err: any) {
      console.warn('Backend chat fallback used:', err);
      lastChatMeta = { fallback: true, at: Date.now() };
      const lastUserMsg = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
      return offlineReply(language, lastUserMsg);
    }
  },

  // Generate comprehensive NSQF Livelihood Mapping
  /** `request`: the career goal in the person's words; without it the roadmap is made from the profile. */
  async generateLivelihoodMapping(
    profile: BeneficiaryProfile,
    language: string,
    request?: string
  ): Promise<LivelihoodAnalysis> {
    const response = await fetch('/api/ai/livelihood-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, language, request }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate livelihood roadmap: ${response.statusText}`);
    }

    return await response.json();
  },

  // Extract structured citizen profile fields from natural language text/voice input
  async extractProfileFromText(text: string, currentProfile: Partial<BeneficiaryProfile> = {}): Promise<Partial<BeneficiaryProfile>> {
    try {
      const response = await fetch('/api/ai/extract-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, currentProfile }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.extracted && Object.keys(data.extracted).length > 0) {
          return data.extracted;
        }
      }
    } catch (e) {
      console.warn('AI extract profile call failed, using client fallback:', e);
    }
    return {};
  },

  // Pause / resume the reply that is currently being spoken
  pauseAudio() {
    userPaused = true;
    if (currentAudio) currentAudio.pause();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.pause();
  },

  resumeAudio() {
    userPaused = false;
    if (currentAudio) currentAudio.play().catch(() => {});
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.resume();
  },

  // Stop any currently playing audio
  stopAudio() {
    userPaused = false;
    speechSession++;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  /**
   * Resolves when the reply now being spoken has finished: waits up to 5 s for speech to
   * start (voices load first), then until it has been quiet for a moment, at most `maxMs`.
   */
  whenSilent(maxMs = 30000): Promise<void> {
    const speaking = () => Boolean((currentAudio && !currentAudio.paused) || (typeof window !== 'undefined' && window.speechSynthesis?.speaking));
    return new Promise((resolve) => {
      const start = Date.now();
      let started = false;
      let quietSince = start;
      const tick = () => {
        const now = Date.now();
        if (speaking()) {
          started = true;
          quietSince = now;
        }
        if ((started && now - quietSince > 700) || (!started && now - start > 5000) || now - start > maxMs) return resolve();
        setTimeout(tick, 150);
      };
      tick();
    });
  },

  /**
   * Short prompts (form questions, "Saved") in the device's own voice: starts instantly and
   * uses no API quota, so a back-and-forth of many short turns never lags.
   */
  async speakQuick(text: string, locale: string = 'en-IN'): Promise<void> {
    this.stopAudio();
    const session = speechSession;
    // No device voice for this language: the backup voice, rather than English-sounding speech
    if (!hasDeviceVoice(locale) && (await speakWithBackupVoice(text, locale))) return;
    for (const piece of splitForSpeech(prepareTextForSpeech(text))) {
      if (session !== speechSession) return;
      await speakWithBrowserVoice(piece, locale);
    }
  },

  // Play text speech with natural voice selection in requested language.
  // The reply is split into sentences that are synthesized in parallel and played
  // back in order, so the first sentence starts quickly and the whole reply is read.
  async playSpeech(text: string, locale: string = 'en-IN'): Promise<void> {
    this.stopAudio();
    const session = speechSession;

    if (!text || text.trim().length === 0) return;

    const prepared = prepareTextForSpeech(text);
    const chunks = splitForSpeech(prepared);
    const voiceName = getStudioVoiceName(locale);

    // Gemini voices used up for now: stream the backup voice sentence by sentence, so the
    // first sentence plays in about a second while the rest downloads behind it.
    if (!(await geminiVoiceAvailable())) {
      if (session !== speechSession) return;
      const saved = await fetchCachedAudio(chunks[0], locale, voiceName);
      if (session !== speechSession) return;
      if (saved && chunks.length === 1) return playAudioData(saved);

      const pieces = splitForSpeech(prepared, 160, 220);
      const pending: Array<Promise<StudioAudio | null>> = [];
      const load = (i: number) => {
        if (i < pieces.length && !pending[i]) pending[i] = fetchLockedAudio(pieces[i], locale, voiceName, 'google');
      };
      load(0);
      load(1);
      for (let i = 0; i < pieces.length; i++) {
        load(i + 2); // keep two pieces downloading ahead of playback
        const audio = await pending[i];
        if (session !== speechSession) return;
        if (audio) await playAudioData(audio);
        else await speakWithBrowserVoice(pieces[i], locale);
        if (session !== speechSession) return;
      }
      return;
    }

    // The first chunk decides the engine; every other chunk is locked to it so the
    // whole reply is spoken in one consistent voice.
    const first = await fetchStudioAudio(chunks[0], locale, voiceName);
    if (session !== speechSession) return;

    if (!first) {
      // Studio voice unavailable: read the entire reply with the browser voice instead
      for (const chunk of chunks) {
        await speakWithBrowserVoice(chunk, locale);
        if (session !== speechSession) return;
      }
      return;
    }

    const rest = chunks.slice(1).map((chunk) => fetchLockedAudio(chunk, locale, voiceName, first.engine));

    await playAudioData(first);
    for (let i = 0; i < rest.length; i++) {
      if (session !== speechSession) return;
      let audio = await rest[i];
      if (session !== speechSession) return;
      if (!audio) {
        // Last resort only: never skip part of the reply
        console.warn('Locked TTS engine failed for a chunk; using fallback for it');
        audio = await fetchStudioAudio(chunks[i + 1], locale, voiceName);
        if (session !== speechSession) return;
      }
      if (audio) {
        await playAudioData(audio);
      } else {
        await speakWithBrowserVoice(chunks[i + 1], locale);
      }
    }
    if (session !== speechSession) return;
  },

  // Transcribe recorded audio
  async transcribeAudioBlob(blob: Blob, languageHint?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const response = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64data,
              mimeType: blob.type || 'audio/webm',
              languageHint,
            }),
          });
          if (!response.ok) {
            throw new Error('Transcription failed');
          }
          const res = await response.json();
          resolve(res.transcript || '');
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
};
