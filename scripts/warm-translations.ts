/**
 * Fills server/i18n/cache with translations of the text the app speaks or shows outside the
 * main pages (Smart Apply text, form questions, labels and options, document names), so the
 * demo does not spend Gemini quota translating them. Run with the server up:
 *   npx tsx scripts/warm-translations.ts [http://localhost:3000]
 */
import { DOC_KINDS, FORM_SCHEMAS, PROFILE_FIELDS } from '../src/data/autofillSchema';
import { getSmartApplyStrings } from '../src/data/smartApplyStrings';

const base = process.argv[2] || 'http://localhost:3000';
const LANGS = ['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'ur'];

const texts = new Set<string>();
const add = (v: unknown) => {
  if (typeof v === 'string' && /[A-Za-z]{2,}/.test(v)) texts.add(v.trim());
  else if (Array.isArray(v)) v.forEach(add);
};
Object.values(getSmartApplyStrings('en')).forEach(add);
for (const f of PROFILE_FIELDS) [f.label, f.question, f.options].forEach(add);
for (const s of FORM_SCHEMAS) for (const f of s.fields as any[]) [f.label, f.question, f.help, f.options].forEach(add);
Object.values(DOC_KINDS).forEach((d) => add(d.label));

const all = [...texts];
console.log(`${all.length} texts`);
for (const lang of LANGS) {
  let missing = 0;
  for (let i = 0; i < all.length; i += 120) {
    const res = await fetch(`${base}/api/i18n/translate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, texts: all.slice(i, i + 120) }) });
    const out = res.ok ? (await res.json()).translations : [];
    missing += all.slice(i, i + 120).filter((_, j) => !out[j]).length;
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(lang, missing ? `${missing} not translated (run again later)` : 'done');
}
