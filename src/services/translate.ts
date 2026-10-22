import type { LanguageCode } from '../types';

/**
 * English → any supported language, through the server's cached Gemini translation.
 * Requests made in the same moment are sent together; results are kept in memory and in
 * this browser, so each string is fetched once.
 */

const STORE_KEY = (lang: string) => `udaan.i18n.${lang}`;
const memory = new Map<string, Map<string, string>>();
const queue = new Map<string, Map<string, Array<(v: string | null) => void>>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_PER_REQUEST = 200;
/** Strings that could not be translated, and when; asked again only after a pause. */
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 30_000;

function cacheFor(lang: string): Map<string, string> {
  let m = memory.get(lang);
  if (!m) {
    m = new Map();
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY(lang)) || '{}');
      for (const [k, v] of Object.entries(saved)) if (typeof v === 'string') m.set(k, v);
    } catch {}
    memory.set(lang, m);
  }
  return m;
}

function persist(lang: string) {
  if (saveTimers.has(lang)) return;
  saveTimers.set(
    lang,
    setTimeout(() => {
      saveTimers.delete(lang);
      try {
        localStorage.setItem(STORE_KEY(lang), JSON.stringify(Object.fromEntries(cacheFor(lang))));
      } catch {}
    }, 1500)
  );
}

/** True when a text has English words worth translating (not only numbers, codes or symbols). */
export const needsTranslation = (text: string) => /[A-Za-z]{2,}/.test(text) && !/^(https?:\/\/|www\.)\S+$/i.test(text.trim()) && !/^\S+@\S+\.\S+$/.test(text.trim());

/** A translation already known, without waiting. */
export const peekTranslation = (text: string, lang: LanguageCode): string | undefined => (lang === 'en' ? text : cacheFor(lang).get(text));

async function flush(lang: string) {
  timers.delete(lang);
  const waiting = queue.get(lang);
  if (!waiting?.size) return;
  queue.delete(lang);
  const all = [...waiting.keys()];
  for (let i = 0; i < all.length; i += MAX_PER_REQUEST) {
    const texts = all.slice(i, i + MAX_PER_REQUEST);
    let out: Array<string | null> = [];
    try {
      const res = await fetch('/api/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, texts }),
      });
      if (res.ok) out = (await res.json()).translations || [];
    } catch {}
    const cache = cacheFor(lang);
    texts.forEach((t, j) => {
      const v = typeof out[j] === 'string' && out[j] ? (out[j] as string) : null;
      if (v) cache.set(t, v);
      else failedAt.set(`${lang}|${t}`, Date.now());
      waiting.get(t)?.forEach((cb) => cb(v));
    });
    persist(lang);
  }
}

function request(text: string, lang: string): Promise<string | null> {
  if (Date.now() - (failedAt.get(`${lang}|${text}`) || 0) < RETRY_AFTER_MS) return Promise.resolve(null);
  return new Promise((resolve) => {
    let waiting = queue.get(lang);
    if (!waiting) queue.set(lang, (waiting = new Map()));
    const list = waiting.get(text) || [];
    list.push(resolve);
    waiting.set(text, list);
    if (!timers.has(lang)) timers.set(lang, setTimeout(() => flush(lang), 40));
  });
}

/** Translations of `texts` (the English text itself where none could be made). */
export async function translateTexts(texts: string[], lang: LanguageCode): Promise<string[]> {
  if (lang === 'en') return texts;
  const cache = cacheFor(lang);
  return Promise.all(texts.map(async (t) => (!needsTranslation(t) ? t : cache.get(t) ?? (await request(t, lang)) ?? t)));
}

/** Written in an Indian script or Urdu already (so not to be translated again). */
const isNative = (text: string) => /[\u0900-\u0DFF\u0600-\u06FF]/.test(text);

/**
 * Text to speak in `lang`: each part that is plain English is translated (parts are cached
 * separately, so a fixed phrase is fetched once however it is combined); parts already in an
 * Indian script, like the hand-written Hindi phrases, are spoken as given. Never waits more than 6 s.
 */
export async function spokenIn(lang: LanguageCode, ...parts: Array<string | undefined | null | false>): Promise<string> {
  const list = parts.filter((p): p is string => Boolean(p && p.trim())).map((p) => p.trim());
  if (lang === 'en') return list.join(' ');
  const english = list.filter((p) => !isNative(p));
  const translated = await Promise.race([
    translateTexts(english, lang),
    new Promise<string[]>((resolve) => setTimeout(() => resolve(english.map((p) => cacheFor(lang).get(p) ?? p)), 6000)),
  ]);
  const byText = new Map(english.map((p, i) => [p, translated[i]]));
  return list.map((p) => byText.get(p) ?? p).join(' ');
}

/** Fetch translations ahead of time (for example every question of a form). */
export const prefetchTranslations = (texts: string[], lang: LanguageCode) => {
  if (lang !== 'en') void translateTexts(texts.filter((t) => t && !isNative(t)), lang);
};
