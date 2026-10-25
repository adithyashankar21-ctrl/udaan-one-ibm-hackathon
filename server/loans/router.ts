/**
 * Loans department helpers that need AI or outside data:
 *  - /understand   turns what a person says into the facts the loan advisor needs,
 *  - /contract     explains a loan agreement / sanction letter / KFS in plain words and flags bad terms,
 *  - /business-plan (+ /pdf) turns a spoken idea into a simple plan a bank can read,
 *  - /fraud-check  checks a loan message, call or app for scam signs,
 *  - /nearby       finds bank branches near the person (OpenStreetMap).
 * Nothing here is stored. Ranking, EMI checks and bundles run in the browser (src/data/loanAdvice.ts).
 */
import express from 'express';
import { Type } from '@google/genai';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Generate } from '../autofill/ocr';
import { IngestError, checkFiles } from '../autofill/ingest';
import { latin } from '../autofill/pdf';
import { LOAN_CATEGORIES } from '../../src/data/loanCatalog';
import { fraudFlags } from '../../src/data/loanAdvice';

function limiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    return list.length <= limit;
  };
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const languageOf = (v: unknown) => clip(v || 'English', 40).replace(/[^A-Za-z ()-]/g, '') || 'English';
const inLanguage = (language: string) =>
  `Write every text for the person entirely in ${language}, in its own script, in simple everyday words a person with little schooling understands. Acronyms in capitals (EMI, APR, KFS, PAN, SBI), numbers, ₹ and web addresses may stay; no other English words, and never an English word in brackets after a translated one.`;

export function createLoansRouter(generate: Generate) {
  const router = express.Router();
  const aiLimit = limiter(80, 60 * 60 * 1000);
  const mapLimit = limiter(30, 60 * 60 * 1000);

  router.use(express.json({ limit: '25mb' }));
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.headers['x-udaan-client'] !== '1') return res.status(403).json({ error: 'Missing client header' });
    next();
  });

  const ask = async (contents: any, schema: any, timeoutMs = 20000) => {
    const res = await generate(
      { contents, config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } } },
      undefined,
      { retryBusy: true, timeoutMs }
    );
    return JSON.parse(res.text || '{}');
  };

  /* ── What the person said → loan facts ─────────────────────────── */
  router.post('/understand', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests' });
    const text = clip(req.body?.text, 600);
    const asking = clip(req.body?.asking, 40);
    if (!text.trim()) return res.json({ need: {} });
    try {
      const out = await ask(
        `A person in India is talking to a loan advisor (any language). ${asking ? `They were just asked about: ${asking}.` : ''}
They said: "${text}"
Already known: ${JSON.stringify(req.body?.known || {}).slice(0, 800)}
Extract ONLY facts they stated or clearly implied. Leave a field out when unsure. Amounts are rupees (2 lakh = 200000, 50 hazar = 50000).
purpose: business = shop, trade, service or small unit; agriculture = crops, dairy, animals, fishing, farm equipment; education = studies or fees; housing = buy, build or repair a house; women = a women's self-help group loan; micro = very small working capital or street vending; quick = urgent personal money or a loan against gold.
roles: vendor = street vendor / hawker; artisan = traditional craftsperson (carpenter, potter, tailor, cobbler, smith…); farmer = farmer, dairy, poultry, fisher; student; shg = member of a self-help group; sanitation = safai karamchari / waste picker.
activity: a few English words for what the money is for (e.g. "tailoring shop", "two buffaloes").`,
        {
          type: Type.OBJECT,
          properties: {
            purpose: { type: Type.STRING, enum: LOAN_CATEGORIES.map((c) => c.id) },
            amount: { type: Type.NUMBER },
            activity: { type: Type.STRING },
            stage: { type: Type.STRING, enum: ['new', 'existing'] },
            socialCategory: { type: Type.STRING, enum: ['SC', 'ST', 'OBC', 'General', 'EWS'] },
            minority: { type: Type.BOOLEAN },
            gender: { type: Type.STRING, enum: ['Female', 'Male', 'Other'] },
            monthlyIncome: { type: Type.NUMBER },
            existingEmi: { type: Type.NUMBER },
            roles: { type: Type.ARRAY, items: { type: Type.STRING, enum: ['vendor', 'artisan', 'farmer', 'student', 'shg', 'sanitation'] } },
            hasGold: { type: Type.BOOLEAN },
            months: { type: Type.NUMBER },
          },
        },
        12000
      );
      res.json({ need: out });
    } catch {
      res.status(503).json({ error: 'Could not understand that just now. Please choose an option or type it.' });
    }
  });

  /* ── Plain-language contract check ─────────────────────────────── */
  router.post('/contract', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests' });
    const language = languageOf(req.body?.language);
    const text = clip(req.body?.text, 20000);
    let files: ReturnType<typeof checkFiles> = [];
    try {
      if (req.body?.files?.length) files = checkFiles(req.body.files);
    } catch (err: any) {
      return res.status(400).json({ error: err instanceof IngestError ? err.message : 'Could not read the file.' });
    }
    if (!text.trim() && !files.length) return res.status(400).json({ error: 'Paste the loan terms or upload the agreement first.' });
    try {
      const out = await ask(
        [
          {
            role: 'user',
            parts: [
              ...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.buffer.toString('base64') } })),
              {
                text: `This is a loan agreement, sanction letter, Key Fact Statement or loan offer given to a person in India.${text ? `\nText:\n${text}` : ''}
Explain it to them. ${inLanguage(language)}
- summary: 3 to 5 short points saying what they are agreeing to (how much they get, what they pay back each month and in total, for how long, what happens if they pay late).
- terms: each important term found (interest rate, APR / yearly cost, processing fee, other fees, insurance, prepayment / foreclosure charge, late payment / bounce charge, collateral, guarantor, tenure, EMI). value = the figure (keep the numbers, write any words around them in the person's language); plain = what it means in simple words; flag = "ok", "watch" or "danger".
  Mark "danger" for: yearly cost (APR) above 30%, processing fee above 3% of the loan, upfront payment before the loan is paid out, compulsory insurance or products bundled in, blank cheques or signed blank papers, prepayment ban or charge above 4%, penal interest on penal interest, permission to contact your phone contacts or take your gallery/photos, the lender keeping original documents of property not mortgaged.
  Mark "watch" for: floating rate without a cap, high late fees, auto-debit of the full balance, very long tenure for a small loan, missing APR.
- missing: important things a fair agreement shows but this one does not (e.g. APR, total amount payable, grievance contact).
- verdict: "ok", "careful" or "avoid"; verdictReason: one sentence.
- questions: 2 to 4 questions to ask the lender before signing.
Never invent figures that are not in the document.`,
              },
            ],
          },
        ],
        {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.ARRAY, items: { type: Type.STRING } },
            terms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { label: { type: Type.STRING }, value: { type: Type.STRING }, plain: { type: Type.STRING }, flag: { type: Type.STRING, enum: ['ok', 'watch', 'danger'] } },
                required: ['label', 'value', 'plain', 'flag'],
              },
            },
            missing: { type: Type.ARRAY, items: { type: Type.STRING } },
            verdict: { type: Type.STRING, enum: ['ok', 'careful', 'avoid'] },
            verdictReason: { type: Type.STRING },
            questions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'terms', 'verdict', 'verdictReason'],
        },
        45000
      );
      res.json(out);
    } catch {
      res.status(503).json({ error: 'The contract check is busy right now. Please try again in a minute.' });
    }
  });

  /* ── Business plan from a spoken idea ──────────────────────────── */
  const PLAN_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      summary: { type: Type.STRING },
      products: { type: Type.ARRAY, items: { type: Type.STRING } },
      customers: { type: Type.STRING },
      location: { type: Type.STRING },
      setupCosts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { item: { type: Type.STRING }, amount: { type: Type.NUMBER } }, required: ['item', 'amount'] } },
      monthlyCosts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { item: { type: Type.STRING }, amount: { type: Type.NUMBER } }, required: ['item', 'amount'] } },
      monthlySales: { type: Type.NUMBER },
      loanNeeded: { type: Type.NUMBER },
      ownContribution: { type: Type.NUMBER },
      repayment: { type: Type.STRING },
      experience: { type: Type.STRING },
      risks: { type: Type.ARRAY, items: { type: Type.STRING } },
      assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['title', 'summary', 'products', 'customers', 'setupCosts', 'monthlyCosts', 'monthlySales', 'loanNeeded', 'repayment', 'risks', 'assumptions'],
  };

  router.post('/business-plan', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests' });
    const description = clip(req.body?.description, 3000);
    const language = languageOf(req.body?.language);
    if (description.trim().split(/\s+/).length < 4) return res.status(400).json({ error: 'Tell a little more about the business — what you will sell, where, and what you need money for.' });
    const facts = JSON.stringify(req.body?.need || {}).slice(0, 600);
    try {
      const prompt = (lang: string) => `A person in India described the small business they want a loan for (any language): "${description}"
Known facts: ${facts}
Write a simple, honest one-page business plan a bank loan officer can read. Write it in ${lang}${lang === 'English' ? '' : ', in its own script, simple words'}.
Use their figures where given. Where a figure is missing, use a realistic, modest estimate for that business in India and add it to "assumptions" so they can correct it. Amounts are rupees. Keep monthly sales believable for a first-year business.
"repayment": how the monthly profit covers the EMI. "risks": 2 to 4 real risks and how they will be handled.`;
      const plan = await ask(prompt('English'), PLAN_SCHEMA, 40000);
      // The person reads it in their language; the bank gets the English one
      const local = language === 'English' ? null : await ask(`${prompt(language)}\nUse exactly these figures and points, only translated: ${JSON.stringify(plan).slice(0, 6000)}`, PLAN_SCHEMA, 40000).catch(() => null);
      res.json({ plan, local });
    } catch {
      res.status(503).json({ error: 'The plan builder is busy right now. Please try again in a minute.' });
    }
  });

  router.post('/business-plan/pdf', async (req, res) => {
    const plan = req.body?.plan;
    if (!plan || typeof plan !== 'object') return res.status(400).json({ error: 'No plan to print.' });
    const name = clip(req.body?.name, 80);
    try {
      const bytes = await businessPlanPdf(plan, name);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="UDAAN-ONE-business-plan.pdf"');
      res.send(Buffer.from(bytes));
    } catch {
      res.status(500).json({ error: 'Could not make the PDF.' });
    }
  });

  /* ── Fraud shield ──────────────────────────────────────────────── */
  router.post('/fraud-check', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests' });
    const text = clip(req.body?.text, 4000);
    const language = languageOf(req.body?.language);
    if (!text.trim()) return res.status(400).json({ error: 'Paste the message, or describe the call or app.' });
    const rules = fraudFlags(text);
    try {
      const out = await ask(
        `A person in India received this loan offer, message, call or app (any language): "${text}"
Rule checks already found: ${rules.map((r) => r.title).join('; ') || 'none'}.
Decide if it looks like a loan scam. Signs: upfront fees, guaranteed approval, asking for OTP/PIN, APK links or screen-sharing apps, personal phone numbers or "agents", unofficial links, pressure, threats, lenders not registered with RBI, fake government scheme agents (government loan schemes never use paid agents).
${inLanguage(language)}
verdict: "looks-genuine", "suspicious" or "scam". reasons: 1 to 4 short points. whatToDo: 2 to 4 short steps (e.g. check on sachet.rbi.org.in, call the lender's official number from its website, report on 1930 / cybercrime.gov.in, never pay or share OTP).`,
        {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING, enum: ['looks-genuine', 'suspicious', 'scam'] },
            reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
            whatToDo: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['verdict', 'reasons', 'whatToDo'],
        },
        15000
      );
      // Rules are never overridden: a "danger" sign is never called genuine
      if (rules.some((r) => r.level === 'danger') && out.verdict === 'looks-genuine') out.verdict = 'suspicious';
      res.json({ ...out, rules });
    } catch {
      res.json({ verdict: rules.some((r) => r.level === 'danger') ? 'scam' : rules.length ? 'suspicious' : 'unknown', reasons: [], whatToDo: [], rules });
    }
  });

  /* ── Nearest bank branches (OpenStreetMap) ─────────────────────── */
  const UA = 'UDAAN-ONE/1.0 (hackathon demo; loan bank finder)';
  // The public Overpass servers are often busy: ask several at once, use the first good answer,
  // and keep it an hour for the same area (rounded to ~1 km)
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  const areaCache = new Map<string, { at: number; data: any }>();
  const overpass = async (query: string, key: string) => {
    const hit = areaCache.get(key);
    if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.data;
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 6000);
    try {
      const data = await Promise.any(
        MIRRORS.map((url) =>
          fetch(url, {
            method: 'POST',
            headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
            signal: stop.signal,
          }).then(async (r) => {
            const json = r.ok ? await r.json() : null;
            if (!Array.isArray(json?.elements)) throw new Error('busy');
            return json;
          })
        )
      );
      if (areaCache.size > 500) areaCache.clear();
      areaCache.set(key, { at: Date.now(), data });
      return data;
    } finally {
      clearTimeout(timer);
      stop.abort();
    }
  };
  // When every Overpass server is down: Nominatim's search inside a box around the person,
  // shaped like Overpass elements so the rest stays the same
  const nominatim = async (kind: string, lat: number, lon: number, lender: string, key: string) => {
    const hit = areaCache.get(`n:${key}:${lender}`);
    if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.data;
    const d = 0.06;
    const params = new URLSearchParams({
      q: kind === 'office' ? 'government office' : lender ? `${lender} bank` : 'bank',
      viewbox: `${lon - d},${lat + d},${lon + d},${lat - d}`,
      bounded: '1',
      format: 'jsonv2',
      limit: '40',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
    });
    const rows = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }).then((r) => r.json());
    if (!Array.isArray(rows)) throw new Error('busy');
    const data = {
      elements: rows.map((r: any) => ({
        lat: Number(r.lat),
        lon: Number(r.lon),
        tags: {
          ...(r.namedetails || {}),
          name: r.name || r.namedetails?.name,
          brand: r.extratags?.brand,
          operator: r.extratags?.operator,
          opening_hours: r.extratags?.opening_hours,
          'addr:housenumber': r.address?.house_number,
          'addr:street': r.address?.road,
          'addr:suburb': r.address?.suburb || r.address?.neighbourhood,
          'addr:postcode': r.address?.postcode,
        },
      })),
    };
    areaCache.set(`n:${key}:${lender}`, { at: Date.now(), data });
    return data;
  };
  router.get('/nearby', async (req, res) => {
    if (!mapLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests' });
    let lat = Number(req.query.lat);
    let lon = Number(req.query.lon);
    const pincode = clip(req.query.pincode, 6).replace(/\D/g, '');
    const kind = req.query.kind === 'office' ? 'office' : 'bank';
    const lender = clip(req.query.lender, 60).toLowerCase();
    const lang = clip(req.query.lang, 2).replace(/[^a-z]/g, '');
    try {
      if (!isFinite(lat) || !isFinite(lon) || (!lat && !lon)) {
        if (pincode.length !== 6) return res.status(400).json({ error: 'Share your location or enter a 6-digit PIN code.' });
        const geo = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }).then((r) => r.json());
        if (!geo?.[0]) return res.status(404).json({ error: 'Could not find that PIN code on the map.' });
        lat = Number(geo[0].lat);
        lon = Number(geo[0].lon);
      }
      const radius = 6000;
      const filter = kind === 'office' ? `nwr(around:${radius},${lat},${lon})["office"="government"];` : `nwr(around:${radius},${lat},${lon})["amenity"="bank"];`;
      const key = `${kind}:${lat.toFixed(2)},${lon.toFixed(2)}`;
      const data = await overpass(`[out:json][timeout:10];(${filter});out center 60;`, key).catch(() => nominatim(kind, lat, lon, lender, key));
      const km = (a: number, b: number) => {
        const R = 6371;
        const dLat = ((a - lat) * Math.PI) / 180;
        const dLon = ((b - lon) * Math.PI) / 180;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((a * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      };
      const places = (data?.elements || [])
        .map((e: any) => {
          const t = e.tags || {};
          const plat = e.lat ?? e.center?.lat;
          const plon = e.lon ?? e.center?.lon;
          // The name in the person's language when the map has it
          const name = (lang && t[`name:${lang}`]) || t.name || t.brand || t.operator || 'Bank';
          return {
            name,
            brand: t.brand || t.operator || '',
            address: [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:city'], t['addr:postcode']].filter(Boolean).join(', '),
            hours: t.opening_hours || '',
            distanceKm: Math.round(km(plat, plon) * 10) / 10,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${plat},${plon}`)}`,
            matchesLender: Boolean(lender && `${name} ${t.brand || ''} ${t.operator || ''}`.toLowerCase().includes(lender)),
          };
        })
        .filter((p: any) => isFinite(p.distanceKm))
        .sort((a: any, b: any) => Number(b.matchesLender) - Number(a.matchesLender) || a.distanceKm - b.distanceKm)
        .slice(0, 12);
      res.json({ places, center: { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 }, source: 'OpenStreetMap' });
    } catch {
      res.status(503).json({ error: 'The map service is busy. Use the map link below instead.' });
    }
  });

  return router;
}

/* ── Business plan PDF ─────────────────────────────────────────────── */

async function businessPlanPdf(plan: any, name: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Business plan - UDAAN ONE');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const NAVY = rgb(0.063, 0.11, 0.212);
  const MUTED = rgb(0.38, 0.42, 0.49);
  const GREEN = rgb(0.09, 0.42, 0.32);
  const W = 595.28;
  const H = 841.89;
  const M = 44;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const rupees = (n: unknown) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const wrap = (text: string, f = font, size = 9.5, width = W - 2 * M) => {
    const words = latin(text).text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const need = (h: number) => {
    if (y - h < M) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const para = (text: string, size = 9.5, f = font, color = NAVY, indent = 0) => {
    for (const l of wrap(text, f, size, W - 2 * M - indent)) {
      need(size + 4);
      page.drawText(l, { x: M + indent, y, size, font: f, color });
      y -= size + 4;
    }
  };
  const heading = (t: string) => {
    need(30);
    y -= 8;
    page.drawText(t.toUpperCase(), { x: M, y, size: 9.5, font: bold, color: GREEN });
    y -= 15;
  };
  const table = (rows: Array<{ item: string; amount: number }>, total: string) => {
    for (const r of rows || []) {
      need(14);
      page.drawText(latin(String(r.item)).text.slice(0, 80), { x: M + 6, y, size: 9, font, color: NAVY });
      page.drawText(rupees(r.amount), { x: W - M - 90, y, size: 9, font, color: NAVY });
      y -= 13;
    }
    need(16);
    page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.4, color: MUTED });
    page.drawText(total, { x: M + 6, y, size: 9, font: bold, color: NAVY });
    page.drawText(rupees((rows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0)), { x: W - M - 90, y, size: 9, font: bold, color: NAVY });
    y -= 16;
  };

  page.drawRectangle({ x: 0, y: H - 64, width: W, height: 64, color: NAVY });
  page.drawText('UDAAN ONE', { x: M, y: H - 30, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText('Business plan for a loan application', { x: M, y: H - 47, size: 9, font, color: rgb(0.85, 0.87, 0.9) });
  y = H - 92;
  para(String(plan.title || 'Business plan'), 15, bold);
  if (name) para(`Prepared for: ${name}`, 9, font, MUTED);
  para(`Prepared on ${new Date().toLocaleDateString('en-IN')} with UDAAN ONE from the applicant's own description. Figures marked as assumptions are estimates to be confirmed.`, 8, font, MUTED);

  heading('Summary');
  para(String(plan.summary || ''));
  heading('Products / services');
  (plan.products || []).forEach((p: string) => para(`- ${p}`, 9.5, font, NAVY, 6));
  heading('Customers and location');
  para(String(plan.customers || ''));
  if (plan.location) para(`Location: ${plan.location}`);
  if (plan.experience) para(`Experience: ${plan.experience}`);

  heading('One-time setup costs');
  table(plan.setupCosts, 'Total setup cost');
  heading('Monthly running costs');
  table(plan.monthlyCosts, 'Total monthly cost');
  const monthlyCost = (plan.monthlyCosts || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  heading('Money in and out (per month)');
  para(`Expected sales: ${rupees(plan.monthlySales)}   Running costs: ${rupees(monthlyCost)}   Profit before EMI: ${rupees((Number(plan.monthlySales) || 0) - monthlyCost)}`, 9.5, bold);
  heading('Funding');
  para(`Loan needed: ${rupees(plan.loanNeeded)}${plan.ownContribution ? `   Own contribution: ${rupees(plan.ownContribution)}` : ''}`, 9.5, bold);
  para(String(plan.repayment || ''));
  heading('Risks and how they will be handled');
  (plan.risks || []).forEach((r: string) => para(`- ${r}`, 9.5, font, NAVY, 6));
  if ((plan.assumptions || []).length) {
    heading('Assumptions (please check)');
    plan.assumptions.forEach((a: string) => para(`- ${a}`, 8.5, font, MUTED, 6));
  }
  y -= 24;
  need(40);
  page.drawLine({ start: { x: W - M - 200, y }, end: { x: W - M, y }, thickness: 0.6, color: NAVY });
  page.drawText('Signature of applicant', { x: W - M - 200, y: y - 12, size: 8, font, color: MUTED });
  const pages = pdf.getPages();
  pages.forEach((p, i) => p.drawText(`UDAAN ONE business plan - page ${i + 1} of ${pages.length} - prepared from the applicant's description, not verified`, { x: M, y: 20, size: 7, font, color: MUTED }));
  return pdf.save();
}
