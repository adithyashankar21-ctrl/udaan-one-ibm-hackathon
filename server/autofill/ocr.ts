/**
 * Document intelligence: identifies the document type and reads its fields with Gemini
 * vision (works for photos, scans and multi-page PDFs, including rotated or low-quality
 * images). Aadhaar numbers are checked and reduced to the last four digits before anything
 * is stored or returned. Reading a document does not prove it is genuine.
 */
import { Type } from '@google/genai';
import { DOC_KINDS, PROFILE_FIELDS, PROFILE_FIELD_MAP, type DocKind, type ProfileKey } from '../../src/data/autofillSchema';
import type { CheckedFile } from './ingest';
import type { DocumentRecord, ExtractedField } from './types';
import { isValidAadhaar, normalise, normaliseDate, scrubAadhaar } from './validate';

export type Generate = (request: Record<string, any>, models?: string[], opts?: { retryBusy?: boolean; timeoutMs?: number }) => Promise<any>;

const KIND_KEYS = Object.keys(DOC_KINDS) as DocKind[];
const PROFILE_KEYS = PROFILE_FIELDS.map((f) => f.key);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    docKind: { type: Type.STRING, enum: KIND_KEYS },
    docKindConfidence: { type: Type.NUMBER },
    pageCount: { type: Type.INTEGER },
    quality: {
      type: Type.OBJECT,
      properties: {
        overall: { type: Type.STRING, enum: ['good', 'fair', 'poor'] },
        rotated: { type: Type.BOOLEAN },
        issues: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['overall', 'rotated', 'issues'],
    },
    fields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, enum: PROFILE_KEYS },
          value: { type: Type.STRING, nullable: true },
          confidence: { type: Type.NUMBER },
          legible: { type: Type.BOOLEAN },
          note: { type: Type.STRING },
        },
        required: ['key', 'confidence', 'legible'],
      },
    },
    validity: {
      type: Type.OBJECT,
      properties: {
        issueDate: { type: Type.STRING, nullable: true },
        expiryDate: { type: Type.STRING, nullable: true },
      },
    },
    extraFields: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }, required: ['label', 'value'] },
    },
  },
  required: ['docKind', 'docKindConfidence', 'pageCount', 'quality', 'fields'],
};

const PROMPT = `You read Indian identity and supporting documents for an application-filling assistant.

1. Identify the document type: aadhaar (UIDAI Aadhaar card or e-Aadhaar), pan (Income Tax PAN card), voter (Election Commission voter ID / EPIC), passport (Indian passport), dl (driving licence or learner's licence), birth (birth certificate), income (income certificate), caste (caste / community certificate), residence (residence / domicile / nativity certificate), bank (bank passbook first page, cancelled cheque or bank statement), utility (electricity, water, gas, landline or broadband bill), education (marksheet, school leaving or degree certificate), ration (ration card), foreign_passport (a passport issued by any country other than India), oci (Overseas Citizen of India card), pio (Person of Indian Origin card), or other (anything else, e.g. hospital birth record, salary slip, affidavit).
2. Read these fields when the document shows them (use exactly these keys):
   fullName — the document holder's name, in English as printed (if only a regional-script name is printed, transliterate it to English and say so in note)
   fatherSpouseName — from "S/O", "D/O", "W/O", "C/O", "Father's name" or "Husband's name"
   dateOfBirth — as DD/MM/YYYY; if only the year of birth is printed, return the year and note "year of birth only"
   gender — Male, Female or Transgender
   aadhaar — the Aadhaar number exactly as printed, digits only (masked cards show only the last 4 digits; return what is visible)
   panNumber, mobile, pincode, district, state
   addressLine — the full address without district, state and PIN code
   socialCategory — SC, ST, OBC, General or EWS; subCaste — the caste or community named
   casteCertificateNumber, incomeCertificateNumber — the certificate's own number
   annualFamilyIncome — the annual income in rupees, digits only
   familySize — number of members listed (ration card)
   education — the qualification, board/university and year, e.g. "10th (SSLC), State Board, 2010"
   bankAccountNumber, bankIfsc, bankName, bankBranch, rationCardNumber
   motherName, placeOfBirth, maritalStatus (Single, Married, Widowed, Divorced or Separated)
   passportNumber (Indian passport only), voterIdNumber (EPIC number), drivingLicenceNumber (also for a learner's licence)
   nationality — the holder's citizenship as printed (foreign passport, OCI or PIO card)
   foreignPassportNumber — the number of a non-Indian passport (also printed on OCI / PIO cards); pioCardNumber
   For a utility bill, fullName is the name the bill is addressed to. Note the bill date in extraFields.
3. For every field: confidence from 0 to 1. If text is blurred, cut off or unreadable, set legible=false and value=null. Never guess digits or letters.
4. quality: overall good/fair/poor, rotated=true if pages are sideways or upside down (still read them), and issues such as glare, blur, cropped edges or a missing page.
5. validity: issueDate — the date of issue (for a bill, the bill date; for a certificate, the date it was issued) and expiryDate — the "valid till" / "date of expiry", both as DD/MM/YYYY. Use null when not printed.
6. extraFields: up to 6 other useful printed details (issuing authority, place of issue), as label/value. Do not repeat the fields above.
7. Do not judge whether the document is genuine. Only report what is printed.`;

export async function extractDocument(generate: Generate, files: CheckedFile[], hint?: DocKind): Promise<Omit<DocumentRecord, 'id' | 'uploadedAt'>> {
  const parts: any[] = files.map((f) => ({ inlineData: { mimeType: f.mime, data: f.buffer.toString('base64') } }));
  parts.push({
    text: `${PROMPT}${hint && hint !== 'other' ? `\nThe person says this is a ${DOC_KINDS[hint].label}; confirm or correct that.` : ''}\nThe upload has ${files.length} file(s); treat them as pages of one document.`,
  });

  const response = await generate(
    {
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    },
    undefined,
    { retryBusy: true, timeoutMs: 60000 }
  );

  const raw = JSON.parse(response.text || '{}');
  const kind: DocKind = KIND_KEYS.includes(raw.docKind) ? raw.docKind : 'other';
  const seen = new Set<string>();
  const fields: ExtractedField[] = [];

  for (const f of Array.isArray(raw.fields) ? raw.fields : []) {
    const key = f?.key as ProfileKey;
    if (!PROFILE_FIELD_MAP[key] || seen.has(key)) continue;
    seen.add(key);
    let value: string | null = typeof f.value === 'string' && f.value.trim() ? f.value.trim() : null;
    let confidence = Math.max(0, Math.min(1, Number(f.confidence) || 0));
    let legible = Boolean(f.legible) && value !== null;
    let note = typeof f.note === 'string' ? scrubAadhaar(f.note).slice(0, 160) : undefined;
    let checksumOk: boolean | undefined;

    if (key === 'aadhaar' && value) {
      const digits = value.replace(/\D/g, '');
      if (digits.length === 12) {
        checksumOk = isValidAadhaar(digits);
        value = `XXXX XXXX ${digits.slice(-4)}`;
        if (!checksumOk) {
          confidence = Math.min(confidence, 0.4);
          note = 'The number read does not pass the Aadhaar checksum — a digit may be misread. Please check.';
        }
      } else if (digits.length === 4) {
        value = `XXXX XXXX ${digits}`;
        note = note || 'Masked Aadhaar — only the last 4 digits are printed.';
      } else {
        value = null;
        legible = false;
        note = 'The Aadhaar number could not be read clearly.';
      }
    } else if (value) {
      value = scrubAadhaar(value);
      const type = PROFILE_FIELD_MAP[key].type;
      if (type !== 'text' && type !== 'select') {
        const n = normalise(type, value, PROFILE_FIELD_MAP[key].options);
        if (n.ok && n.value) value = n.value;
        else {
          confidence = Math.min(confidence, 0.5);
          note = n.error ? `Format looks wrong: ${n.error}` : note;
        }
      }
      if (key === 'dateOfBirth' && /^\d{4}$/.test(value)) {
        confidence = Math.min(confidence, 0.5);
        note = 'Only the year of birth is printed — please give the full date.';
      }
    }

    fields.push({ key, value: legible ? value : null, confidence, legible, note, checksumOk, merged: false });
  }

  const extraFields = (Array.isArray(raw.extraFields) ? raw.extraFields : [])
    .slice(0, 6)
    .map((x: any) => ({ label: String(x?.label || '').slice(0, 60), value: scrubAadhaar(String(x?.value || '')).slice(0, 120) }))
    .filter((x: any) => x.label && x.value);

  const dateOf = (v: unknown) => (typeof v === 'string' && v.trim() ? normaliseDate(v) || undefined : undefined);
  const validity = { issueDate: dateOf(raw.validity?.issueDate), expiryDate: dateOf(raw.validity?.expiryDate) };

  const q = raw.quality || {};
  return {
    kind,
    kindConfidence: Math.max(0, Math.min(1, Number(raw.docKindConfidence) || 0)),
    label: DOC_KINDS[kind].label,
    fileNames: files.map((f) => f.name),
    pageCount: Math.max(files.length, Number(raw.pageCount) || files.length),
    quality: {
      overall: ['good', 'fair', 'poor'].includes(q.overall) ? q.overall : 'fair',
      rotated: Boolean(q.rotated),
      issues: (Array.isArray(q.issues) ? q.issues : []).map((s: any) => String(s).slice(0, 100)).slice(0, 5),
    },
    fields,
    extraFields,
    validity: validity.issueDate || validity.expiryDate ? validity : undefined,
    requestedKind: hint && hint !== 'other' && KIND_KEYS.includes(hint) ? hint : undefined,
    originalRetained: false,
  };
}

/** Use Gemini to read one answer given in free speech (any Indian language). */
export async function interpretAnswer(
  generate: Generate,
  field: { label: string; type: string; options?: string[] },
  answer: string
): Promise<{ understood: boolean; value: string }> {
  const response = await generate(
    {
      contents: `A person filling a government application form was asked for "${field.label}" (type: ${field.type}${
        field.options ? `, one of: ${field.options.join(' | ')}` : ''
      }). They answered (possibly in an Indian language, possibly by voice): "${answer.slice(0, 500)}".
Return the value to write on an English form: numbers as digits, dates as DD/MM/YYYY, amounts in rupees as digits only, names and places transliterated to English (Latin script). If the answer does not contain the requested information, set understood=false.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { understood: { type: Type.BOOLEAN }, value: { type: Type.STRING } },
          required: ['understood', 'value'],
        },
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    // One fast model is enough to read a short answer
    ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
    { retryBusy: false, timeoutMs: 4000 }
  );
  const parsed = JSON.parse(response.text || '{}');
  return { understood: Boolean(parsed.understood), value: String(parsed.value || '').trim() };
}
