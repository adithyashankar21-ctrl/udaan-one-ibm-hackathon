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
import { maskNumbers, mixesScripts, unmaskNumbers } from '../../src/data/languageTools';
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
- Simple, everyday, respectful words a person with little schooling understands. Native script only.
- Keep unchanged: the brand "UDAAN ONE", scheme and act names (PM Vishwakarma, PM-AJAY, PMEGP, MUDRA, PM SVANidhi, NSQF, PMKVY), document names that are proper nouns (Aadhaar, PAN), acronyms (OCR, PDF, PIN, AI, IFSC, OTP), numbers, phone numbers, URLs, emails and placeholders in curly braces like {days}.
- Keep the same punctuation, emoji and leading/trailing symbols. Keep line breaks.
- A text that is only a name, code or number stays as it is.
- Translate whole words: never mix English letters into a word of the native script.
- Use only the ${language} script. Never use letters or words from another Indian language or from Urdu/Hindi, unless the English text itself contains them.
Return exactly one translation per input, in the same order.`;

/** Translates English texts into `lang` (cached); null where a text could not be translated. */
export type Translate = (lang: string, texts: string[], urgent?: boolean) => Promise<Array<string | null>>;

export function createTranslator(generate: Generate): Translate {
  const translateBatch = async (lang: string, texts: string[], retry = false): Promise<void> => {
    const res = await generate(
      {
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(texts) }] }],
        config: {
          systemInstruction: rules(LANGUAGES[lang]),
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
    if (!Array.isArray(out) || out.length !== texts.length) throw new Error('Translation count mismatch');
    const cache = cacheFor(lang);
    const mixed: string[] = [];
    texts.forEach((t, i) => {
      if (typeof out[i] !== 'string' || !out[i].trim()) return;
      // Never keep a translation that slips in another language's letters
      if (mixesScripts(out[i], lang as LanguageCode, t)) mixed.push(t);
      else cache[t] = out[i];
    });
    scheduleSave(lang);
    if (mixed.length && !retry) {
      console.warn(`Translation to ${lang}: ${mixed.length} mixed-script result(s), asking again`);
      await translateBatch(lang, mixed, true);
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
