/**
 * Translates every English text of the app into every language ahead of time, so nothing is
 * left in English and nothing waits on Gemini while people use the app. Texts come from
 * scripts/extract-ui-strings.mts (all pages, windows, messages and data files) plus every form's
 * questions, labels and options. Results are saved in server/i18n/cache (shipped with the app).
 * Run with the server up; it paces itself for the free Gemini tier and can be re-run any time —
 * only what is still missing is sent.
 *
 *   npx tsx scripts/warm-translations.ts [http://localhost:3000] [lang,lang,…]
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOC_KINDS, FORM_SCHEMAS, PROFILE_FIELDS } from '../src/data/autofillSchema';
import { getSmartApplyStrings } from '../src/data/smartApplyStrings';
import { maskNumbers } from '../src/data/languageTools';
import { LENDER_TYPE_LABEL, LOAN_LISTINGS } from '../src/data/loanCatalog';

const base = process.argv[2] || 'http://localhost:3000';
const LANGS = (process.argv[3] || 'hi,ta,te,kn,ml,mr,bn,gu,pa,or,ur').split(',');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATCH = 100;
const PAUSE_MS = 4500;

const texts = new Set<string>(JSON.parse(execFileSync('npx', ['tsx', path.join(ROOT, 'scripts/extract-ui-strings.mts')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })));
const add = (v: unknown) => {
  if (typeof v === 'string' && /[A-Za-z]{2,}/.test(v)) texts.add(v.trim());
  else if (Array.isArray(v)) v.forEach(add);
};
Object.values(getSmartApplyStrings('en')).forEach(add);
for (const f of PROFILE_FIELDS) [f.label, f.question, f.options].forEach(add);
for (const s of FORM_SCHEMAS) for (const f of s.fields as any[]) [f.label, f.question, f.help, f.options].forEach(add);
Object.values(DOC_KINDS).forEach((d) => add(d.label));
// Loans page sentences built with numbers and names (numbers become {0}, so one sample covers all)
for (const l of LOAN_LISTINGS) {
  add([`Compare ${l.offers.length} lenders`, `Best match: ${l.name}`, `That sounds like: ${l.name}`, `Rates checked ${l.checked}; your rate depends on your credit score and the lender’s Key Fact Statement.`]);
  add(`*EMI uses each lender’s lowest published rate, or a typical ${l.estimateRate}% where none is published.`);
  l.offers.forEach((o) => [o.lender, o.rate, o.note, LENDER_TYPE_LABEL[o.type]].forEach(add));
}
add([
  'Compare 1 lender',
  'Estimated EMI from ₹17,030 a month for ₹2,00,000 over 12 months',
  '₹25,00,000 is above this loan’s limit of ₹20,00,000.',
  `Tell us what the money is for. We compare ${LOAN_LISTINGS.filter((l) => l.backing === 'government').length} government loan schemes with bank, NBFC and microfinance loans, estimate your EMI, and fill the application — by typing, from your documents, or by voice.`,
  `Show all ${LOAN_LISTINGS.length} loans`,
  '1 loan · rates are indicative (checked October 2026); the lender decides.',
  '21 loans · rates are indicative (checked October 2026); the lender decides.',
  '6 months',
  '1 year (12 months)',
  '2 years (24 months)',
]);
const all = [...texts];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cached = (lang: string): Record<string, string> => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'server/i18n/cache', `${lang}.json`), 'utf8'));
  } catch {
    return {};
  }
};

/** Languages translated at the same time (each sends one batch at a time). */
const WORKERS = Number(process.env.WORKERS || 4);

const warm = async (lang: string) => {
  {
    for (let pass = 1; pass <= 3; pass++) {
      // The server's saved file can lag a moment behind; ask the server, which answers from memory
      const have = cached(lang);
      // Saved keys have numbers as {0}, {1}… (one translation for every count)
      const todo = all.filter((t) => !(maskNumbers(t).key in have));
      let missing = 0;
      for (let i = 0; i < todo.length; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        try {
          const res = await fetch(`${base}/api/i18n/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Sent straight to Gemini (not behind other translations): the workers pace themselves
            body: JSON.stringify({ lang, texts: batch, urgent: true }),
            signal: AbortSignal.timeout(180000),
          });
          const out = res.ok ? (await res.json()).translations : [];
          missing += batch.filter((_, j) => !out[j]).length;
        } catch {
          missing += batch.length;
        }
        await sleep(PAUSE_MS);
      }
      console.log(`${lang} pass ${pass}: ${todo.length} sent, ${missing} still missing`);
      if (!missing) break;
      await sleep(30000);
    }
  }
};

(async () => {
  console.log(`${all.length} texts, languages: ${LANGS.join(' ')}, ${WORKERS} at a time`);
  const queue = [...LANGS];
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      for (let lang = queue.shift(); lang; lang = queue.shift()) await warm(lang);
    })
  );
  console.log('done');
})();
