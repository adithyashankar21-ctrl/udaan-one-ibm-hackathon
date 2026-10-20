/**
 * Document generation:
 *  - a structured application draft (always available),
 *  - filling an official fillable PDF (AcroForm) the person uploads, keeping its structure,
 *  - writing values onto a scanned / image form at positions found by layout detection.
 */
import { Type } from '@google/genai';
import {
  PDFButton,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFFont,
  PDFImage,
  PDFOptionList,
  PDFPage,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from 'pdf-lib';
import type { Generate } from './ocr';
import type { DraftView, FieldView } from './mapping';
import type { ApplicantPhoto, OfficialForm, Placement } from './types';

/* ── Text safety: the standard PDF fonts only cover Latin-1 ───────────── */

export function latin(text: string): { text: string; lossy: boolean } {
  let lossy = false;
  const out = text
    .replace(/₹\s?/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, () => {
      lossy = true;
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { text: out, lossy };
}

const display = (f: FieldView, aadhaarFull?: string) => {
  if (f.type === 'aadhaar' && aadhaarFull) return aadhaarFull.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
  if (f.type === 'money' && /^\d+$/.test(f.value)) return `Rs. ${Number(f.value).toLocaleString('en-IN')}`;
  return f.value;
};

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/* ── Applicant photo ──────────────────────────────────────────────────── */

const embedPhoto = (pdf: PDFDocument, photo: ApplicantPhoto) =>
  photo.mime === 'image/png' ? pdf.embedPng(Buffer.from(photo.dataB64, 'base64')) : pdf.embedJpg(Buffer.from(photo.dataB64, 'base64'));

/** Fill a box with the photo, cropping the overflow (like a photo pasted into a frame). */
function drawPhoto(page: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
  // Centre horizontally; keep the top (where the head is) when cropping vertically
  page.drawImage(img, { x: x + (w - iw) / 2, y: y + h - ih, width: iw, height: ih });
  page.pushOperators(popGraphicsState());
}

/* ── Structured draft ─────────────────────────────────────────────────── */

const NAVY = rgb(0.063, 0.11, 0.212);
const MUTED = rgb(0.38, 0.42, 0.49);
const SAFFRON = rgb(0.96, 0.65, 0.14);
const GREEN = rgb(0.09, 0.42, 0.32);

export async function generateDraftPdf(view: DraftView, opts: { aadhaarFull?: string; approvedAt?: number; photo?: ApplicantPhoto }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${view.scheme?.formTitle || 'Application'} - UDAAN ONE draft`);
  pdf.setProducer('UDAAN ONE');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 40;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const handwritten: string[] = [];

  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 20) newPage();
  };
  const text = (s: string, x: number, size: number, f = font, color = NAVY) => page.drawText(latin(s).text, { x, y, size, font: f, color });

  // Header
  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 74, width: W, height: 4, color: SAFFRON });
  y = H - 32;
  text('UDAAN ONE', M, 18, bold, rgb(1, 1, 1));
  y = H - 50;
  text('AI for Opportunity. Technology for All.', M, 9, font, rgb(0.85, 0.87, 0.9));
  y = H - 100;

  // Photo box, top right: 35 x 45 mm
  const PW = 99;
  const PH = 128;
  const px = W - M - PW;
  const py = H - 90 - PH;
  page.drawRectangle({ x: px - 2, y: py - 2, width: PW + 4, height: PH + 4, borderColor: NAVY, borderWidth: 0.8 });
  if (opts.photo) {
    drawPhoto(page, await embedPhoto(pdf, opts.photo), px, py, PW, PH);
  } else {
    for (const [i, l] of ['Affix recent', 'passport-size', 'photograph', '(35 x 45 mm)'].entries()) {
      page.drawText(l, { x: px + (PW - font.widthOfTextAtSize(l, 8)) / 2, y: py + PH / 2 + 12 - i * 11, size: 8, font, color: MUTED });
    }
  }
  const bodyW = W - 2 * M - PW - 14;

  for (const line of wrap(latin(view.scheme?.formTitle || 'Application').text, bold, 14, bodyW)) {
    text(line, M, 14, bold);
    y -= 18;
  }

  // Notice box
  const notice: Array<[string, PDFFont, number]> = [
    ['APPLICATION PREPARATION DRAFT - NOT AN OFFICIAL GOVERNMENT FORM. NOT SUBMITTED.', bold, 8.5],
    ['Copy these details into the official form, or take this page with you when you apply.', font, 8],
    ['Details read from documents are not verified by UDAAN ONE; the office will check your originals.', font, 8],
  ];
  const noticeLines = notice.flatMap(([s, f, size]) => wrap(s, f, size, bodyW - 16).map((l) => [l, f, size] as const));
  const boxH = noticeLines.length * 12 + 10;
  page.drawRectangle({ x: M, y: y - boxH + 6, width: bodyW, height: boxH, color: rgb(1, 0.97, 0.9), borderColor: SAFFRON, borderWidth: 1 });
  y -= 8;
  for (const [l, f, size] of noticeLines) {
    text(l, M + 8, size, f, f === bold ? rgb(0.55, 0.3, 0.02) : rgb(0.45, 0.28, 0.05));
    y -= 12;
  }
  y = Math.min(y - 14, py - 16);

  text(`Reference: ${view.reference}`, M, 8.5, bold, MUTED);
  text(`Prepared: ${new Date().toLocaleDateString('en-IN')}`, 250, 8.5, bold, MUTED);
  text(`Status: ${view.approved ? 'Approved by applicant' : 'Not yet approved'}`, 400, 8.5, bold, MUTED);
  y -= 20;

  const labelW = 175;
  const valueX = M + labelW;
  const valueW = W - M - valueX - 95;
  const srcX = W - M - 90;

  for (const section of view.sections) {
    need(40);
    page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: rgb(0.95, 0.94, 0.9) });
    y += 0;
    text(section.toUpperCase(), M + 6, 9, bold, GREEN);
    y -= 22;
    for (const f of view.fields.filter((x) => x.section === section)) {
      const raw = f.value ? display(f, opts.aadhaarFull) : '';
      const { text: safe, lossy } = latin(raw);
      let shown = safe || (f.required ? '[ to be filled ]' : '-');
      if (lossy) {
        shown = safe ? `${safe} [write by hand]` : '[write by hand - non-English text]';
        handwritten.push(f.label);
      }
      const lines = wrap(shown, font, 9.5, valueW);
      const labelLines = wrap(latin(`${f.label}${f.required ? ' *' : ''}`).text, bold, 9, labelW - 12);
      const rows = Math.max(lines.length, labelLines.length);
      need(rows * 13 + 6);
      const src = f.status === 'confirmed' ? 'confirmed' : f.status === 'extracted' ? 'from document' : f.value ? 'self-declared' : '';
      if (src) text(src, srcX, 7.5, font, MUTED);
      for (let i = 0; i < rows; i++) {
        if (labelLines[i]) page.drawText(labelLines[i], { x: M + 6, y, size: 9, font: bold, color: MUTED });
        if (lines[i]) page.drawText(lines[i], { x: valueX, y, size: 9.5, font, color: NAVY });
        y -= 13;
      }
      page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.4, color: rgb(0.88, 0.87, 0.83) });
      y -= 3;
    }
    y -= 6;
  }

  // Documents: one line per requirement, with what will be used and what else is accepted
  need(30 + view.documents.length * 24);
  text('DOCUMENTS TO ATTACH (self-attested copies; carry originals)', M, 9.5, bold, GREEN);
  y -= 15;
  for (const d of view.documents) {
    const using =
      d.id === 'photo'
        ? d.have ? ' - printed on page 1; carry 2 more copies' : ' - paste one in the box on page 1'
        : d.satisfiedBy.length ? ` - using: ${d.satisfiedBy.join(', ')}` : d.manual ? ' - bring / upload yourself' : '';
    need(26);
    text(`[${d.have ? 'x' : ' '}] ${d.label}${d.required ? '' : ' (if available)'}${using}`, M + 6, 9, d.have ? font : bold);
    y -= 11;
    const accepted = d.note || (d.accepted.length > 1 ? `Accepted: ${d.accepted.join(', ')}` : '');
    if (accepted) {
      for (const l of wrap(latin(accepted).text, font, 7.5, W - 2 * M - 24)) {
        page.drawText(l, { x: M + 20, y, size: 7.5, font, color: MUTED });
        y -= 10;
      }
    }
    y -= 3;
  }
  text('The official portal or office decides which documents it accepts; this list is a guide.', M + 6, 7.5, font, MUTED);
  y -= 20;

  // Next steps
  need(40);
  text('WHERE AND HOW TO APPLY', M, 9.5, bold, GREEN);
  y -= 15;
  for (const s of view.nextSteps) {
    const lines = wrap(latin(`- ${s}`).text, font, 8.5, W - 2 * M - 10);
    need(lines.length * 12);
    for (const l of lines) {
      page.drawText(l, { x: M + 6, y, size: 8.5, font, color: NAVY });
      y -= 12;
    }
  }
  y -= 10;

  // Declaration
  need(90);
  text('DECLARATION', M, 9.5, bold, GREEN);
  y -= 14;
  const decl = opts.approvedAt
    ? `The applicant reviewed and approved these details in UDAAN ONE on ${new Date(opts.approvedAt).toLocaleString('en-IN')}. Sign the official form yourself; this draft is not a signature.`
    : 'Not yet approved by the applicant.';
  for (const l of wrap(decl, font, 8.5, W - 2 * M)) {
    page.drawText(l, { x: M, y, size: 8.5, font, color: NAVY });
    y -= 12;
  }
  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: M + 160, y }, thickness: 0.6, color: NAVY });
  page.drawLine({ start: { x: W - M - 200, y }, end: { x: W - M, y }, thickness: 0.6, color: NAVY });
  y -= 12;
  text('Date and place', M, 8, font, MUTED);
  text('Signature / thumb impression of applicant', W - M - 200, 8, font, MUTED);

  if (handwritten.length) {
    y -= 22;
    need(20);
    text(`Write by hand (the PDF font cannot show this script): ${handwritten.join(', ')}`, M, 8, bold, rgb(0.6, 0.2, 0.1));
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`UDAAN ONE preparation draft - page ${i + 1} of ${pages.length} - Ref ${view.reference}`, { x: M, y: 20, size: 7, font, color: MUTED })
  );
  return pdf.save();
}

/* ── Official forms ───────────────────────────────────────────────────── */

const HEURISTICS: Array<[RegExp, string]> = [
  [/father|husband|spouse|guardian|s\/o|d\/o|w\/o/i, 'fatherSpouseName'],
  [/ifsc/i, 'bankIfsc'],
  [/account|a\/c/i, 'bankAccountNumber'],
  [/branch/i, 'bankBranch'],
  [/bank/i, 'bankName'],
  [/(applicant|candidate|full|beneficiary)?.?name/i, 'fullName'],
  [/dob|birth/i, 'dateOfBirth'],
  [/gender|sex/i, 'gender'],
  [/aadha?r|uid/i, 'aadhaar'],
  [/\bpan\b|pan.?(no|number|card)/i, 'panNumber'],
  [/mobile|phone|contact/i, 'mobile'],
  [/e-?mail/i, 'email'],
  [/pin.?code|postal|\bpin\b/i, 'pincode'],
  [/district/i, 'district'],
  [/state/i, 'state'],
  [/address/i, 'addressLine'],
  [/caste.?cert|community.?cert/i, 'casteCertificateNumber'],
  [/income.?cert/i, 'incomeCertificateNumber'],
  [/income/i, 'annualFamilyIncome'],
  [/category|caste/i, 'socialCategory'],
  [/ifsc/i, 'bankIfsc'],
  [/account|a\/c/i, 'bankAccountNumber'],
  [/branch/i, 'bankBranch'],
  [/bank/i, 'bankName'],
  [/ration/i, 'rationCardNumber'],
  [/qualification|education/i, 'education'],
  [/occupation|profession/i, 'occupation'],
];

function heuristicMap(name: string, keys: Set<string>): string | null {
  const n = name.replace(/[_\-.\[\]0-9]+/g, ' ');
  for (const [re, key] of HEURISTICS) if (re.test(n) && keys.has(key)) return key;
  return null;
}

export interface AnalysedForm {
  kind: 'acroform' | 'scanned';
  fieldMap?: Record<string, string | null>;
  placements?: Placement[];
  unplaced?: string[];
}

export async function analyseOfficialForm(generate: Generate, bytes: Buffer, mime: string, fields: FieldView[]): Promise<AnalysedForm> {
  const keys = new Set(fields.map((f) => f.key));
  const catalogue = fields.map((f) => `${f.key}: ${f.label}`).join('\n');
  // Scanned forms: also find where the photo is pasted
  const scanKeys = new Set([...keys, 'photo']);
  const scanCatalogue = `${catalogue}\nphoto: the box where the applicant's passport-size photograph is pasted (give the whole box)`;

  if (mime === 'application/pdf') {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pdfFields = pdf.getForm().getFields();
    if (pdfFields.length > 0) {
      const names = pdfFields.map((f) => f.getName());
      const fieldMap: Record<string, string | null> = Object.fromEntries(names.map((n) => [n, heuristicMap(n, keys)]));
      try {
        const response = await generate(
          {
            contents: `Map each field of a government application PDF to the matching data key, or "none".
PDF field names:
${names.map((n) => `- ${n}`).join('\n')}

Data keys:
${catalogue}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { pdfField: { type: Type.STRING }, key: { type: Type.STRING, enum: [...keys, 'none'] } },
                  required: ['pdfField', 'key'],
                },
              },
              temperature: 0,
              thinkingConfig: { thinkingBudget: 0 },
            },
          },
          undefined,
          { retryBusy: false, timeoutMs: 20000 }
        );
        for (const m of JSON.parse(response.text || '[]')) {
          if (m && names.includes(m.pdfField)) fieldMap[m.pdfField] = keys.has(m.key) ? m.key : null;
        }
      } catch {
        // Field-name heuristics already filled the map
      }
      return { kind: 'acroform', fieldMap };
    }
  }

  // Scanned PDF or image: find where each answer should be written.
  const response = await generate(
    {
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mime, data: bytes.toString('base64') } },
            {
              text: `This is a blank or partly blank application form (scanned or photographed). For each data key below whose question appears on the form, give the page number (1-based) and the box where the answer should be WRITTEN (the blank space or line next to or under the label, not the label itself), as box_2d [ymin, xmin, ymax, xmax] normalised to 0-1000 for that page. Give confidence 0-1. Leave out keys the form does not ask for.

${scanCatalogue}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, enum: [...scanKeys] },
              page: { type: Type.INTEGER },
              box_2d: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              confidence: { type: Type.NUMBER },
            },
            required: ['key', 'page', 'box_2d', 'confidence'],
          },
        },
        temperature: 0,
      },
    },
    undefined,
    { retryBusy: true, timeoutMs: 60000 }
  );
  const placements: Placement[] = [];
  for (const p of JSON.parse(response.text || '[]')) {
    const b = p?.box_2d;
    if (!scanKeys.has(p?.key) || !Array.isArray(b) || b.length !== 4 || Number(p.confidence) < 0.6) continue;
    const [ymin, xmin, ymax, xmax] = b.map((n: number) => Math.max(0, Math.min(1000, Number(n))));
    if (ymax - ymin < 5 || xmax - xmin < 20) continue;
    if (placements.some((x) => x.fieldKey === p.key)) continue;
    placements.push({ fieldKey: p.key, page: Math.max(1, Number(p.page) || 1), box: [ymin, xmin, ymax, xmax] });
  }
  const placed = new Set(placements.map((p) => p.fieldKey));
  return { kind: 'scanned', placements, unplaced: fields.filter((f) => f.value && !placed.has(f.key)).map((f) => f.label) };
}

export async function fillOfficialForm(form: OfficialForm, view: DraftView, aadhaarFull?: string, photo?: ApplicantPhoto): Promise<Uint8Array> {
  const bytes = Buffer.from(form.bytesB64, 'base64');
  const byKey = new Map(view.fields.map((f) => [f.key, f]));
  const valueFor = (key: string | null | undefined) => {
    const f = key ? byKey.get(key) : undefined;
    return f && f.value ? latin(display(f, aadhaarFull)).text : '';
  };

  if (form.kind === 'acroform') {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const acro = pdf.getForm();
    // A photo button (an image field) gets the applicant's photo
    const photoField = acro.getFields().find((f) => f instanceof PDFButton && /photo|image|picture|pic\b/i.test(f.getName()));
    if (photo && photoField) {
      try {
        (photoField as PDFButton).setImage(await embedPhoto(pdf, photo));
      } catch {
        // Unusual button appearance — the person pastes the photo instead
      }
    }
    for (const field of acro.getFields()) {
      const value = valueFor(form.fieldMap?.[field.getName()]);
      if (!value) continue;
      try {
        if (field instanceof PDFTextField) {
          const max = field.getMaxLength();
          field.setText(max ? value.slice(0, max) : value);
        } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
          const opt = field.getOptions().find((o) => o.toLowerCase().startsWith(value.toLowerCase().slice(0, 3)));
          if (opt) field.select(opt);
        } else if (field instanceof PDFRadioGroup) {
          const opt = field.getOptions().find((o) => o.toLowerCase().startsWith(value.toLowerCase().slice(0, 3)));
          if (opt) field.select(opt);
        } else if (field instanceof PDFCheckBox) {
          if (/^(yes|true|y)$/i.test(value)) field.check();
        }
      } catch {
        // A read-only or unusual field is left for the person to fill
      }
    }
    acro.updateFieldAppearances(font);
    return pdf.save();
  }

  // Scanned form: write each value into its detected box.
  let pdf: PDFDocument;
  if (form.mime === 'application/pdf') {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  } else {
    pdf = await PDFDocument.create();
    const img = form.mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const scale = Math.min(595.28 / img.width, 841.89 / img.height);
    const p = pdf.addPage([img.width * scale, img.height * scale]);
    p.drawImage(img, { x: 0, y: 0, width: img.width * scale, height: img.height * scale });
  }
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const photoImg = photo ? await embedPhoto(pdf, photo) : null;
  for (const pl of form.placements || []) {
    const page = pages[pl.page - 1];
    if (pl.fieldKey === 'photo') {
      if (!page || !photoImg) continue;
      const { width, height } = page.getSize();
      const [ymin, xmin, ymax, xmax] = pl.box;
      const bw = ((xmax - xmin) / 1000) * width;
      const bh = ((ymax - ymin) / 1000) * height;
      // Keep the 35:45 shape, centred in the detected box
      const h = Math.min(bh, (bw * 45) / 35);
      const w = (h * 35) / 45;
      drawPhoto(page, photoImg, (xmin / 1000) * width + (bw - w) / 2, height - (ymax / 1000) * height + (bh - h) / 2, w, h);
      continue;
    }
    const value = valueFor(pl.fieldKey);
    if (!page || !value) continue;
    const { width, height } = page.getSize();
    const [ymin, xmin, ymax, xmax] = pl.box;
    const boxW = ((xmax - xmin) / 1000) * width;
    const boxH = ((ymax - ymin) / 1000) * height;
    let size = Math.min(11, Math.max(6, boxH * 0.7));
    while (size > 5 && font.widthOfTextAtSize(value, size) > boxW) size -= 0.5;
    page.drawText(value, {
      x: (xmin / 1000) * width + 2,
      y: height - (ymax / 1000) * height + Math.max(1, (boxH - size) / 2),
      size,
      font,
      color: rgb(0.05, 0.15, 0.55),
    });
  }
  return pdf.save();
}
