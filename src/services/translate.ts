import type { LanguageCode } from '../types';
import { maskNumbers, maskPrivate, unmaskNumbers, unmaskPrivate } from '../data/languageTools';

/**
 * English → any supported language, through the server's cached Gemini translation.
 * Requests made in the same moment are sent together; results are kept in memory and in
 * this browser, so each string is fetched once.
 */

// v3: earlier copies could hold translations that mixed in English or another language's letters
const STORE_KEY = (lang: string) => `udaan.i18n.v3.${lang}`;
try {
  Object.keys(localStorage)
    .filter((k) => /^udaan\.i18n\.(?:v2\.)?[a-z]{2}$/.test(k))
    .forEach((k) => localStorage.removeItem(k));
} catch {}
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

/* ── Personal details never leave for translation ─────────────────────
 * Translations are shared by everyone (cached on the server), so a person's name, address,
 * application reference or ID numbers must never be sent. They are swapped for placeholders
 * ({pa}, {pb}…) before a text goes out and put back into the translation when it returns:
 * "My profile: Asha Devi" is translated as "My profile: {pa}".
 */
let privateValues: string[] = [];

/** The signed-in person's own details to keep out of translation (set by the app from the profile). */
export function setPrivateValues(values: Array<string | undefined | null>) {
  const set = new Set<string>();
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s.length >= 3 && /[\p{L}\d]/u.test(s)) set.add(s);
  }
  // Longest first, so "Asha Devi Kumari" is caught before "Asha Devi"
  privateValues = [...set].sort((a, b) => b.length - a.length);
}

/** `text` with this person's details and personal IDs as placeholders, and the details to put back. */
const shield = (text: string) => maskPrivate(text, privateValues);
const unshield = unmaskPrivate;

/** True when a text has English words worth translating (not only numbers, codes or symbols). */
export const needsTranslation = (text: string) =>
  /[A-Za-z]{2,}/.test(text.replace(/\{p[a-z]\}/g, ' ')) && !/^(https?:\/\/|www\.)\S+$/i.test(text.trim()) && !/^\S+@\S+\.\S+$/.test(text.trim());

/** The whole saved dictionary for each language (numbers as {0}…), loaded once. */
const dictionaries = new Map<string, Record<string, string>>();
const loading = new Map<string, Promise<void>>();

/** Load every saved translation for `lang` in one request (resolves even if it fails). */
export function loadDictionary(lang: LanguageCode): Promise<void> {
  if (lang === 'en' || dictionaries.has(lang)) return Promise.resolve();
  if (!loading.has(lang)) {
    loading.set(
      lang,
      fetch(`/api/i18n/dictionary/${lang}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => void dictionaries.set(lang, d || {}))
        .catch(() => void loading.delete(lang))
    );
  }
  return loading.get(lang)!;
}

/** A translation already known, without waiting. */
export const peekTranslation = (text: string, lang: LanguageCode): string | undefined => {
  if (lang === 'en') return text;
  const s = shield(text);
  const back = (v: string) => (s.values.length ? unshield(v, s.values) ?? text : v);
  const hit = cacheFor(lang).get(s.text);
  if (hit !== undefined) return back(hit);
  const d = dictionaries.get(lang);
  if (!d) return undefined;
  const { key, numbers } = maskNumbers(s.text);
  return d[key] !== undefined ? back(unmaskNumbers(d[key], numbers)) : undefined;
};

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

/** Translate now, ahead of interface text waiting in line (for words about to be spoken). */
async function translateUrgently(texts: string[], lang: LanguageCode): Promise<string[]> {
  const cache = cacheFor(lang);
  // Sent and cached with personal details as placeholders
  const shielded = texts.map(shield);
  const missing = [...new Set(shielded.map((s) => s.text).filter((t) => needsTranslation(t) && !cache.has(t)))];
  if (missing.length) {
    try {
      const res = await fetch('/api/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, texts: missing, urgent: true }),
      });
      const out: Array<string | null> = res.ok ? (await res.json()).translations || [] : [];
      missing.forEach((t, i) => out[i] && cache.set(t, out[i] as string));
      persist(lang);
    } catch {}
  }
  return texts.map((t, i) => {
    const v = cache.get(shielded[i].text);
    return v === undefined ? t : unshield(v, shielded[i].values) ?? t;
  });
}

/** Translations of `texts` (the English text itself where none could be made). */
export async function translateTexts(texts: string[], lang: LanguageCode): Promise<string[]> {
  if (lang === 'en') return texts;
  return Promise.all(
    texts.map(async (t) => {
      if (!needsTranslation(t)) return t;
      const known = peekTranslation(t, lang);
      if (known !== undefined) return known;
      // Only the text with personal details as placeholders goes out
      const s = shield(t);
      if (!needsTranslation(s.text)) return t;
      const v = await request(s.text, lang);
      return v ? unshield(v, s.values) ?? t : t;
    })
  );
}

/** Written in an Indian script or Urdu already (so not to be translated again). */
const isNative = (text: string) => /[\u0900-\u0DFF\u0600-\u06FF]/.test(text);

/**
 * Text to speak in `lang`: each part that is plain English is translated (parts are cached
 * separately, so a fixed phrase is fetched once however it is combined); parts already in an
 * Indian script, like the hand-written Hindi phrases, are spoken as given. Never waits more than 8 s.
 */
export async function spokenIn(lang: LanguageCode, ...parts: Array<string | undefined | null | false>): Promise<string> {
  const list = parts.filter((p): p is string => Boolean(p && p.trim())).map((p) => p.trim());
  if (lang === 'en') return list.join(' ');
  const english = list.filter((p) => !isNative(p));
  const translated = await Promise.race([
    translateUrgently(english, lang),
    new Promise<string[]>((resolve) => setTimeout(() => resolve(english.map((p) => cacheFor(lang).get(p) ?? p)), 8000)),
  ]);
  const byText = new Map(english.map((p, i) => [p, translated[i]]));
  return list.map((p) => byText.get(p) ?? p).join(' ');
}

/** Fetch translations ahead of time (for example every question of a form). */
export const prefetchTranslations = (texts: string[], lang: LanguageCode) => {
  if (lang !== 'en') void translateTexts(texts.filter((t) => t && !isNative(t)), lang);
};

/** A browser pop-up message in the chosen language (pop-ups are outside the page, so not translated on screen). */
export async function alertIn(lang: LanguageCode, text: string) {
  const [t] = await translateTexts([text], lang);
  window.alert(t);
}
