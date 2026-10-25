/**
 * Interface translation: turns the app's English text into any supported language with Gemini.
 * Every translated string is kept on disk (server/i18n/cache/<lang>.json, shipped with the app),
 * so each string is translated once and the demo does not spend quota on it again.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Type } from '@google/genai';
import type { Generate } from '../autofill/ocr';
import { dropEnglishGlosses, englishWordsIn, leavesEnglish, maskNumbers, mixesScripts, unmaskNumbers } from '../../src/data/languageTools';
import type { LanguageCode } from '../../src/types';

const LANGUAGES: Record<string, string> = {
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi (Gurmukhi script)',
  or: 'Odia',
  ur: 'Urdu (Perso-Arabic script)',
};

const MAX_TEXTS = 300;
const MAX_LENGTH = 1200;
const BATCH = 120;

const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cache');
const caches = new Map<string, Record<string, string>>();
const saveTimers = new Map<string, NodeJS.Timeout>();
/**
 * Batches run one at a time: the free Gemini tier allows about 15 requests a minute, and the
 * assistant's replies must not wait behind a burst of interface translation.
 */
let chain: Promise<unknown> = Promise.resolve();
const oneAtATime = <T>(job: () => Promise<T>): Promise<T> => {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
};
/** Strings being translated right now, so two pages asking at once share one request. */
const inFlight = new Map<string, Promise<string | undefined>>();

function cacheFor(lang: string): Record<string, string> {
  let cache = caches.get(lang);
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(path.join(cacheDir, `${lang}.json`), 'utf8'));
    } catch {
      cache = {};
    }
    caches.set(lang, cache!);
  }
  return cache!;
}

function scheduleSave(lang: string) {
  if (saveTimers.has(lang)) return;
  saveTimers.set(
    lang,
    setTimeout(() => {
      saveTimers.delete(lang);
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        const sorted = Object.fromEntries(Object.entries(cacheFor(lang)).sort(([a], [b]) => a.localeCompare(b)));
        fs.writeFileSync(path.join(cacheDir, `${lang}.json`), JSON.stringify(sorted, null, 1));
      } catch (err: any) {
        console.warn('Could not save translations:', err?.message);
      }
    }, 2000)
  );
}

const rules = (language: string) => `Translate each English text of a government services app for people in India into ${language}.
Rules:
- Simple, everyday, respectful words a person with little schooling understands. Write EVERYTHING in the ${language} script — the reader must never see an English word.
- Names of schemes, banks, lenders, portals, documents, places and products are written in the ${language} script too, using the official ${language} name when there is one (for example Aadhaar, MUDRA Yojana, PM Vishwakarma, Bank of Baroda, Skill India, Smart Apply, Learning Hub — all in ${language} letters).
- Only these stay in Latin letters: the brand "UDAAN ONE", acronyms written in capitals (PAN, IFSC, OTP, PDF, PIN, AI, SBI, HDFC, EMI, KCC, PM-AJAY, NBFC), numbers, phone numbers, URLs, emails and placeholders in curly braces like {0} or {days}.
- Never return a text unchanged in English.
- Keep the same punctuation, emoji and leading/trailing symbols. Keep line breaks.
- A text that is only a name, code or number stays as it is.
- Translate whole words: never mix English letters into a word of the native script.
- Never add the English word in brackets after a translated one, e.g. not "<word> (masked)" or "<word> (Key Fact Statement)".
- Use only the ${language} script. Never use letters or words from another Indian language or from Urdu/Hindi, unless the English text itself contains them.
Return exactly one translation per input, in the same order.`;

/** Translates English texts into `lang` (cached); null where a text could not be translated. */
export type Translate = (lang: string, texts: string[], urgent?: boolean) => Promise<Array<string | null>>;

export function createTranslator(generate: Generate): Translate {
  /** English words and names → how they are written in `lang` (translated, or spelled as they sound). */
  const nativeSpellings = async (lang: string, words: string[]): Promise<Record<string, string>> => {
    if (!words.length) return {};
    const res = await generate(
      {
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(words) }] }],
        config: {
          systemInstruction: `Each input is an English word or name from a government services app in India. Write it in the ${LANGUAGES[lang]} script: the usual ${LANGUAGES[lang]} word or official name if there is one, otherwise spelled as it sounds in ${LANGUAGES[lang]} letters. Never return Latin letters. Return exactly one per input, in the same order.`,
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      undefined,
      { retryBusy: true, timeoutMs: 20000 }
    );
    const out = JSON.parse(res.text || '[]');
    const map: Record<string, string> = {};
    if (Array.isArray(out) && out.length === words.length)
      words.forEach((w, i) => {
        if (typeof out[i] === 'string' && out[i].trim() && !/[A-Za-z]/.test(out[i]) && !mixesScripts(out[i], lang as LanguageCode)) map[w] = out[i].trim();
      });
    return map;
  };
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** `retry` lists, for a second try, the English words each text's first translation left in. */
  const translateBatch = async (lang: string, texts: string[], retry: string[][] | false = false): Promise<void> => {
    const leftover = retry ? [...new Set(retry.flat())].slice(0, 60) : [];
    const res = await generate(
      {
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(texts) }] }],
        config: {
          systemInstruction:
            rules(LANGUAGES[lang]) +
            (retry
              ? `\nAn earlier attempt left English words or letters of another script in these texts. Write every word, including names, in the ${LANGUAGES[lang]} script.` +
                (leftover.length ? ` These English words were left: ${leftover.join(', ')}. Translate each, or write it as it sounds in ${LANGUAGES[lang]} letters.` : '')
              : ''),
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      undefined,
      { retryBusy: true, timeoutMs: 25000 }
    );
    const out = JSON.parse(res.text || '[]');
    if (!Array.isArray(out) || out.length !== texts.length) {
      if (texts.length === 1) throw new Error('Translation count mismatch');
      // One awkward text can throw the whole batch off: translate the halves separately
      const half = Math.ceil(texts.length / 2);
      await translateBatch(lang, texts.slice(0, half), retry && retry.slice(0, half));
      await translateBatch(lang, texts.slice(half), retry && retry.slice(half));
      return;
    }
    const cache = cacheFor(lang);
    const mixed: string[] = [];
    const mixedWords: string[][] = [];
    const stillEnglish: Array<[string, string]> = [];
    texts.forEach((t, i) => {
      if (typeof out[i] !== 'string' || !out[i].trim()) return;
      out[i] = dropEnglishGlosses(out[i], t);
      // Never keep a translation that slips in another language's letters or leaves English words
      const impure = mixesScripts(out[i], lang as LanguageCode, t) || leavesEnglish(out[i], t);
      if (!impure) cache[t] = out[i];
      else if (!retry) {
        mixed.push(t);
        mixedWords.push(englishWordsIn(out[i], t));
      }
      // Second try: keep it only if it is at least in the right script, never English unchanged
      else if (!mixesScripts(out[i], lang as LanguageCode, t) && out[i].trim() !== t.trim()) {
        cache[t] = out[i];
        stillEnglish.push([t, out[i]]);
      }
    });
    // Last step for words the model keeps in English (mostly names): look each one up and swap it in
    if (stillEnglish.length) {
      const words = [...new Set(stillEnglish.flatMap(([t, tr]) => englishWordsIn(tr, t)))].sort((a, b) => b.length - a.length);
      const spelled = await nativeSpellings(lang, words.slice(0, 150)).catch(() => ({}) as Record<string, string>);
      for (const [t, tr] of stillEnglish) {
        let fixed = tr;
        for (const w of words) if (spelled[w]) fixed = fixed.replace(new RegExp(`(?<![A-Za-z])${escape(w)}(?![A-Za-z])`, 'g'), spelled[w]);
        cache[t] = fixed;
      }
    }
    scheduleSave(lang);
    if (mixed.length && !retry) {
      console.warn(`Translation to ${lang}: ${mixed.length} result(s) with English or another script, asking again`);
      await translateBatch(lang, mixed, mixedWords);
    }
  };

  const translateKeys = async (lang: string, texts: string[], urgent: boolean) => {
    const cache = cacheFor(lang);
    const missing = [...new Set(texts.filter((t) => t.trim() && !(t in cache) && !inFlight.has(`${lang}|${t}`)))];
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const job = (urgent ? translateBatch(lang, batch) : oneAtATime(() => translateBatch(lang, batch))).catch((err) =>
        console.warn(`Translation to ${lang} failed:`, String(err?.message || err).slice(0, 160))
      );
      batch.forEach((t) => {
        const key = `${lang}|${t}`;
        inFlight.set(
          key,
          job.then(() => cacheFor(lang)[t]).finally(() => inFlight.delete(key))
        );
      });
    }
    return Promise.all(texts.map(async (t) => cache[t] ?? (await inFlight.get(`${lang}|${t}`)) ?? null));
  };

  return async (lang, texts, urgent = false) => {
    if (lang === 'en' || !LANGUAGES[lang]) return texts;
    // Translate with numbers as placeholders, then put each text's own numbers back
    const masked = texts.map(maskNumbers);
    const out = await translateKeys(lang, masked.map((m) => m.key), urgent);
    return out.map((t, i) => (t == null ? null : unmaskNumbers(t, masked[i].numbers)));
  };
}

/** Every saved translation for a language (keys have numbers as {0}, {1}…). */
export const dictionary = (lang: string) => (LANGUAGES[lang] ? cacheFor(lang) : null);

export function createTranslateRouter(translate: Translate) {
  const router = express.Router();

  // The whole language at once, so pages show translated straight away
  router.get('/dictionary/:lang', (req, res) => {
    const d = dictionary(req.params.lang);
    if (!d) return res.status(404).json({ error: 'Unsupported language' });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(d);
  });

  router.post('/translate', async (req, res) => {
    const lang = String(req.body?.lang || '');
    // Words about to be spoken go ahead of interface text waiting in line
    const urgent = req.body?.urgent === true;
    const raw = req.body?.texts;
    if (!LANGUAGES[lang]) return res.status(400).json({ error: 'Unsupported language' });
    if (!Array.isArray(raw) || raw.length > MAX_TEXTS) return res.status(400).json({ error: 'Send up to 300 texts' });
    const texts = raw.map((t) => String(t ?? '').slice(0, MAX_LENGTH));
    res.json({ translations: await translate(lang, texts, urgent) });
  });

  return router;
}
