/**
 * Letter help — for people who cannot easily read official letters:
 *  - /letter      reads a government / bank / office letter (photo, PDF or pasted text) and explains it
 *                 in the person's language: what it is, what it asks, deadlines, why something was
 *                 rejected and how to fix it, plus a short text to read aloud;
 *  - /appeal      drafts a formal reply / appeal / grievance letter in English (what offices accept),
 *                 with an explanation of it in the person's language;
 *  - /appeal/pdf  prints that letter on A4, ready to sign.
 * Nothing here is stored: letters are read in memory and forgotten.
 */
import express from 'express';
import { Type } from '@google/genai';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Generate } from '../autofill/ocr';
import { IngestError, checkFiles, checkPdfs } from '../autofill/ingest';
import { latin } from '../autofill/pdf';
import { RELATIONS, cleanHousehold } from '../../src/data/familySchemes';

function limiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    return list.length <= limit;
  };
}

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const languageOf = (v: unknown) => clip(v || 'English', 40).replace(/[^A-Za-z ()-]/g, '') || 'English';
const inLanguage = (language: string) =>
  `Write every text meant for the person entirely in ${language}, in its own script, in simple everyday words a person with little schooling understands. Names of schemes and offices, acronyms in capitals (PAN, KYC, DBT, IFSC), numbers, dates, ₹ and web addresses may stay as they are; no other English words, and never an English word in brackets after a translated one.`;

export const LETTER_KINDS = ['rejection', 'approval', 'payment_due', 'documents_needed', 'visit_or_hearing', 'legal_notice', 'information', 'possible_scam', 'other'] as const;

const LETTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    readable: { type: Type.BOOLEAN },
    kind: { type: Type.STRING, enum: [...LETTER_KINDS] },
    urgency: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    title: { type: Type.STRING },
    from: { type: Type.STRING },
    summary: { type: Type.ARRAY, items: { type: Type.STRING } },
    deadlines: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { what: { type: Type.STRING }, date: { type: Type.STRING } }, required: ['what', 'date'] },
    },
    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
    reasons: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { reason: { type: Type.STRING }, fix: { type: Type.STRING } }, required: ['reason', 'fix'] },
    },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    canReply: { type: Type.BOOLEAN },
    replyKind: { type: Type.STRING, enum: ['appeal', 'grievance', 'reply', 'none'] },
    readAloud: { type: Type.STRING },
    official: {
      type: Type.OBJECT,
      properties: {
        issuer: { type: Type.STRING },
        officeAddress: { type: Type.STRING },
        reference: { type: Type.STRING },
        letterDate: { type: Type.STRING },
        subject: { type: Type.STRING },
        scheme: { type: Type.STRING },
        addressedTo: { type: Type.STRING },
        reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
        appealTo: { type: Type.STRING },
      },
    },
  },
  required: ['readable', 'kind', 'urgency', 'title', 'summary', 'actions', 'canReply', 'replyKind', 'readAloud', 'official'],
};

const APPEAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    to: { type: Type.ARRAY, items: { type: Type.STRING } },
    subject: { type: Type.STRING },
    reference: { type: Type.STRING },
    salutation: { type: Type.STRING },
    body: { type: Type.ARRAY, items: { type: Type.STRING } },
    closing: { type: Type.STRING },
    enclosures: { type: Type.ARRAY, items: { type: Type.STRING } },
    toFill: { type: Type.ARRAY, items: { type: Type.STRING } },
    explain: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['to', 'subject', 'salutation', 'body', 'closing', 'explain'],
};

export function createHelpRouter(generate: Generate) {
  const router = express.Router();
  const aiLimit = limiter(60, 60 * 60 * 1000);

  router.use(express.json({ limit: '40mb' }));
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.headers['x-udaan-client'] !== '1') return res.status(403).json({ error: 'Missing client header' });
    next();
  });

  const ask = async (contents: any, schema: any, timeoutMs = 30000, thinkingBudget = 0) => {
    const res = await generate(
      { contents, config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, thinkingConfig: { thinkingBudget } } },
      undefined,
      { retryBusy: true, timeoutMs }
    );
    return JSON.parse(res.text || '{}');
  };

  /* ── Read and explain a letter ─────────────────────────────────── */
  router.post('/letter', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests. Please try again in a while.' });
    const language = languageOf(req.body?.language);
    const text = clip(req.body?.text, 20000);
    let files: ReturnType<typeof checkFiles> = [];
    try {
      if (req.body?.files?.length) {
        files = checkFiles(req.body.files);
        await checkPdfs(files);
      }
    } catch (err: any) {
      return res.status(400).json({ error: err instanceof IngestError ? err.message : 'Could not read the file.' });
    }
    if (!text.trim() && !files.length) return res.status(400).json({ error: 'Scan or upload the letter, or paste its text, first.' });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const out = await ask(
        [
          {
            role: 'user',
            parts: [
              ...files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.buffer.toString('base64') } })),
              {
                text: `A person in India received this letter, notice, SMS or message (any language) and cannot easily read it.${text ? `\nText of it:\n${text}` : ''}
Today is ${today}. Read it carefully and explain it to them. ${inLanguage(language)}
- readable: false only if the pages are not a letter or cannot be read at all (then keep other texts short and say so in title).
- kind: rejection (application, claim or KYC refused or put on hold), approval (sanctioned, selected, benefit released), payment_due (bill, demand, dues, EMI, fine), documents_needed (asks for documents, KYC, corrections), visit_or_hearing (asked to appear, verification visit, interview, hearing), legal_notice (court, police, recovery, eviction), information, possible_scam (asks for money to a personal account or UPI, OTP, fees to "release" a benefit, threats, unofficial links), other.
- urgency: high if a deadline is within 15 days, money or a legal step is at stake, or a benefit stops; medium if there is something to do; low if only information.
- title: one short line saying what this letter is (e.g. "Your PM Kisan payment is stopped").
- from: who sent it, as written.
- summary: 2 to 5 short points saying what the letter says.
- deadlines: every date by which they must act or appear; date as YYYY-MM-DD when the letter gives a full date, otherwise as written. what = what must be done by then.
- actions: 2 to 5 clear steps, in order, for what they should do now (which office, which document, which website or helpline the letter names).
- reasons: for a rejection or hold, each reason given in the letter; fix = how to fix that reason in simple words. Empty otherwise.
- warnings: anything that looks wrong or risky (money asked to a personal number or UPI, OTP asked, no reference number, pressure). Government offices never ask for fees to a personal account.
- canReply / replyKind: appeal for a rejection that can be challenged, grievance when a benefit is delayed or stopped without a clear reason, reply when the letter asks for a written answer; none otherwise (also none for a possible scam).
- readAloud: 60 to 120 words in ${language}, spoken to the person in second person: what the letter is, the most important deadline and the first thing to do. No lists, no symbols.
- official: in ENGLISH, copied from the letter exactly where present (leave a field empty when the letter does not show it): issuer (department or bank), officeAddress, reference (application / file / letter number), letterDate, subject, scheme, addressedTo (the person's name as written), reasons (each rejection reason in English), appealTo (the authority or office the letter says to appeal or complain to).
Every field above except official is for the person: title, summary, deadlines[].what, actions, reasons[].reason, reasons[].fix, warnings and readAloud must ALL be in ${language} — translate the letter's wording, never copy English sentences from it.
Never invent facts, numbers, dates or offices that are not in the letter.`,
              },
            ],
          },
        ],
        LETTER_SCHEMA,
        60000
      );
      if (out.kind === 'possible_scam') {
        out.canReply = false;
        out.replyKind = 'none';
      }
      res.json(out);
    } catch {
      res.status(503).json({ error: 'The letter reader is busy right now. Please try again in a minute.' });
    }
  });

  /* ── "Tell us about your family" → household facts ─────────────── */
  const FAMILY_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      members: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            relation: { type: Type.STRING, enum: RELATIONS.map((r) => r.id) },
            name: { type: Type.STRING },
            age: { type: Type.NUMBER, nullable: true },
            gender: { type: Type.STRING, enum: ['Female', 'Male', 'Other'] },
            study: { type: Type.STRING, enum: ['none', 'school', 'college'] },
            work: { type: Type.STRING, enum: ['none', 'seeking', 'farmer', 'unorganised', 'artisan', 'salaried', 'business'] },
            pregnant: { type: Type.BOOLEAN },
            widow: { type: Type.BOOLEAN },
            disability: { type: Type.BOOLEAN },
          },
          required: ['relation', 'age'],
        },
      },
      area: { type: Type.STRING, enum: ['rural', 'urban'] },
      category: { type: Type.STRING, enum: ['SC', 'ST', 'OBC', 'General', 'EWS'] },
      annualIncome: { type: Type.NUMBER },
      bpl: { type: Type.BOOLEAN },
      pucca: { type: Type.BOOLEAN },
      hasLpg: { type: Type.BOOLEAN },
      ownsFarmland: { type: Type.BOOLEAN },
    },
    required: ['members'],
  };

  router.post('/family', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests. Please try again in a while.' });
    const text = clip(req.body?.text, 2000);
    if (text.trim().split(/\s+/).length < 3) return res.status(400).json({ error: 'Tell us a little more — who lives with you, and their ages.' });
    try {
      const out = await ask(
        `A person in India describes their household (any language, spoken words): "${text}"
The person speaking is relation "self". List every person they mention who lives with them, including themselves when they say anything about themselves.
Extract ONLY what they said or clearly implied; leave a field out when unsure. For each person give age as a number, or null only when no age is stated or implied ("saath saal" = 60). A baby = age 0. ALWAYS set age for EVERY person whose age is stated, whatever their relation (wife, son, daughter, mother and so on), and set study and work for each person when it is stated.
work: farmer (farming, dairy, fishing), unorganised (daily wage, labourer, construction, domestic worker, street vendor, driver, mason), artisan (carpenter, potter, tailor, weaver, cobbler, blacksmith, barber, goldsmith and other traditional crafts), salaried (regular job with salary), business (shop or own business), seeking (looking for work), none (home-maker, retired, not working).
study: school (studying in a school, up to class 12), college (college, ITI, diploma, university), none.
Household: area rural (village) or urban (town, city); category only if they say it; annualIncome in rupees per YEAR (convert monthly ×12; "2 lakh" = 200000); bpl true if they have a BPL, Antyodaya (AAY), yellow / pink / priority ration card; pucca false for a kutcha / mud / temporary house or no house; hasLpg false if they cook on wood / chulha or have no gas; ownsFarmland true if the family owns farmland.
Names exactly as said (in the original script).`,
        FAMILY_SCHEMA,
        25000,
        1024
      );
      res.json({ household: cleanHousehold(out) });
    } catch {
      res.status(503).json({ error: 'Could not understand that right now. Please try again, or add each person below.' });
    }
  });

  /* ── Draft an appeal / grievance / reply ──────────────────────── */
  router.post('/appeal', async (req, res) => {
    if (!aiLimit(req.ip || 'ip')) return res.status(429).json({ error: 'Too many requests. Please try again in a while.' });
    const language = languageOf(req.body?.language);
    const official = req.body?.official && typeof req.body.official === 'object' ? req.body.official : {};
    const replyKind = ['appeal', 'grievance', 'reply'].includes(req.body?.replyKind) ? req.body.replyKind : 'appeal';
    const explanation = clip(req.body?.explanation, 2000);
    const me = req.body?.applicant && typeof req.body.applicant === 'object' ? req.body.applicant : {};
    const applicant = {
      name: clip(me.name, 80),
      address: clip(me.address, 240),
      phone: clip(me.phone, 20),
    };
    try {
      const out = await ask(
        `Write a short, polite, formal ${replyKind === 'appeal' ? 'appeal against a rejection' : replyKind === 'grievance' ? 'grievance letter about a delayed or stopped benefit' : 'written reply'} in ENGLISH for a person in India, to be printed, signed and submitted at the office.
The letter they received (English facts): ${JSON.stringify(official).slice(0, 3000)}
What the person says in their own words (any language; translate the meaning): "${explanation || 'nothing added'}"
Applicant: ${JSON.stringify(applicant)}
Rules:
- to: address lines of the authority — the appeal authority if the letter names one, else the issuing office (officer's designation, office, address as given).
- subject: one line naming the reference number and scheme when known.
- reference: the reference / application number when known.
- body: 3 to 5 short paragraphs: who is writing and which letter this answers (reference and date); each reason given and the person's answer or correction to it; the documents enclosed; the request (reconsider, release the benefit, correct the record) and a request for a written reply.
- enclosures: documents that support the answer (e.g. corrected Aadhaar copy, bank passbook first page, income certificate), only those the reasons or the person's words call for.
- Enclosures must match what the person says they did or have: proof of each correction or step (e.g. e-KYC acknowledgement for completed e-KYC). Never call a document corrected unless the person said so.
- A date the person gives without month or year → keep it and add a blank such as "[month and year]".
- Never invent facts. Where something needed is unknown (reference number, date, office address, account number) write a blank in square brackets such as "[application number]" and list it in toFill (in English).
- closing: "Yours faithfully," — the name, address and phone are printed below it separately, do not repeat them in the body.
- explain: 2 to 4 short points in ${language} telling the person what this letter says, what to attach, and where to submit it. ${inLanguage(language)}`,
        APPEAL_SCHEMA,
        45000
      );
      res.json({ letter: { ...out, applicant, replyKind } });
    } catch {
      res.status(503).json({ error: 'The letter writer is busy right now. Please try again in a minute.' });
    }
  });

  router.post('/appeal/pdf', async (req, res) => {
    const letter = req.body?.letter;
    if (!letter || typeof letter !== 'object' || !Array.isArray(letter.body)) return res.status(400).json({ error: 'No letter to print.' });
    try {
      const bytes = await letterPdf(letter);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="UDAAN-ONE-letter.pdf"');
      res.send(Buffer.from(bytes));
    } catch {
      res.status(500).json({ error: 'Could not make the PDF.' });
    }
  });

  return router;
}

/** A plain A4 letter, the way offices expect it: sender, date, addressee, subject, body, signature. */
async function letterPdf(letter: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Letter - UDAAN ONE');
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const small = await pdf.embedFont(StandardFonts.Helvetica);
  const INK = rgb(0.08, 0.1, 0.16);
  const MUTED = rgb(0.42, 0.45, 0.5);
  const W = 595.28;
  const H = 841.89;
  const M = 64;
  let page = pdf.addPage([W, H]);
  let y = H - 72;
  const s = (v: unknown, n = 2000) => latin(clip(v, n)).text;
  const wrap = (text: string, f = font, size = 11.5, width = W - 2 * M) => {
    const lines: string[] = [];
    for (const para of s(text).split('\n')) {
      let line = '';
      for (const w of para.split(' ')) {
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          if (line) lines.push(line);
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const need = (h: number) => {
    if (y - h < 80) {
      page = pdf.addPage([W, H]);
      y = H - 72;
    }
  };
  const write = (text: string, opts: { f?: typeof font; size?: number; gap?: number; x?: number; color?: typeof INK } = {}) => {
    const { f = font, size = 11.5, gap = 4, x = M, color = INK } = opts;
    for (const l of wrap(text, f, size, W - M - x)) {
      need(size + gap);
      page.drawText(l, { x, y, size, font: f, color });
      y -= size + gap;
    }
  };

  const a = letter.applicant || {};
  // Sender block, top right
  const sender = [a.name || '[Your full name]', ...(s(a.address, 240) || '[Your address]').split(/,\s*|\n/).filter(Boolean).slice(0, 4), a.phone ? `Phone: ${a.phone}` : ''].filter(Boolean);
  const sx = W - M - 200;
  for (const l of sender) {
    page.drawText(s(l, 60), { x: sx, y, size: 11, font, color: INK });
    y -= 15;
  }
  page.drawText(`Date: ${new Date().toLocaleDateString('en-IN')}`, { x: sx, y, size: 11, font, color: INK });
  y -= 30;

  write('To,');
  for (const l of (letter.to || []).slice(0, 6)) write(String(l));
  y -= 10;
  write(`Subject: ${letter.subject || ''}`, { f: bold });
  if (letter.reference) write(`Reference: ${letter.reference}`, { f: bold });
  y -= 10;
  write(String(letter.salutation || 'Respected Sir/Madam,'));
  y -= 4;
  for (const p of letter.body.slice(0, 8)) {
    write(String(p), { gap: 5 });
    y -= 8;
  }
  write(String(letter.closing || 'Yours faithfully,'));
  y -= 40;
  need(60);
  page.drawLine({ start: { x: M, y: y + 12 }, end: { x: M + 170, y: y + 12 }, thickness: 0.5, color: MUTED });
  write('Signature / thumb impression', { size: 9.5, color: MUTED });
  write(a.name || '[Your full name]', { f: bold });

  if (letter.enclosures?.length) {
    y -= 14;
    write('Enclosures:', { f: bold });
    letter.enclosures.slice(0, 10).forEach((e: string, i: number) => write(`${i + 1}. ${e}`, { x: M + 10 }));
  }

  // Honest footer on every page
  for (const p of pdf.getPages()) {
    p.drawText('Drafted with UDAAN ONE from the letter you received. Check every detail, fill any [blanks], then sign.', { x: M, y: 40, size: 7.5, font: small, color: MUTED });
  }
  return pdf.save();
}
