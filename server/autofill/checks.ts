/**
 * Automatic checks on an uploaded document: is it readable, is it the document it claims to
 * be, do its numbers have the right shape, is it still valid, and does it belong to the
 * applicant. A document with a failing check does not count towards an application's
 * requirements. These checks cannot prove a document is genuine — the office does that.
 */
import { DOC_KINDS, PROFILE_FIELD_MAP, type DocKind, type ProfileKey } from '../../src/data/autofillSchema';
import { comparable } from './profile';
import type { DocCheck, DocumentRecord, ProfileState } from './types';
import { normaliseDate } from './validate';

const DAY = 24 * 60 * 60 * 1000;

function toTime(ddmmyyyy?: string): number | null {
  const m = ddmmyyyy?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() : null;
}

const value = (doc: DocumentRecord, key: ProfileKey) => doc.fields.find((f) => f.key === key && f.value)?.value || undefined;

/** The main number each kind of document carries, with the format it should have. */
const NUMBER_RULES: Partial<Record<DocKind, { key: ProfileKey; pattern?: RegExp; format?: string }>> = {
  aadhaar: { key: 'aadhaar' },
  pan: { key: 'panNumber', pattern: /^[A-Z]{5}\d{4}[A-Z]$/, format: '5 letters, 4 digits, 1 letter (ABCDE1234F)' },
  passport: { key: 'passportNumber', pattern: /^[A-Z][0-9]{7}$/, format: '1 letter and 7 digits (A1234567)' },
  voter: { key: 'voterIdNumber', pattern: /^[A-Z]{3}[0-9]{7}$/, format: '3 letters and 7 digits (ABC1234567)' },
  dl: { key: 'drivingLicenceNumber', pattern: /^[A-Z]{2}\d{2}(19|20)\d{2}\d{7}$/, format: 'State code, RTO code, year and 7 digits (MH1420110012345)' },
  bank: { key: 'bankAccountNumber', pattern: /^\d{9,18}$/, format: '9 to 18 digits' },
  ration: { key: 'rationCardNumber' },
  foreign_passport: { key: 'foreignPassportNumber' },
  oci: { key: 'foreignPassportNumber' },
  pio: { key: 'pioCardNumber' },
};

/** Fourth character of a PAN tells whose PAN it is. */
const PAN_HOLDER: Record<string, string> = {
  C: 'a company', H: 'a Hindu Undivided Family', F: 'a firm', A: 'an association of persons', T: 'a trust',
  B: 'a body of individuals', L: 'a local authority', J: 'an artificial juridical person', G: 'a government body',
};

/** Kinds whose expiry should be printed, and how much validity many applications expect. */
const EXPIRING: Partial<Record<DocKind, number>> = { passport: 182, foreign_passport: 182, dl: 0 };

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'smt', 'shri', 'sri', 'kumari', 'km', 'dr', 'late']);

function nameTokens(name: string): string[] {
  return comparable('fullName', name)
    .split(' ')
    .filter((t) => t && !HONORIFICS.has(t));
}

/** same: identical words; similar: initials or a missing middle name; different: otherwise. */
export function compareNames(a: string, b: string): 'same' | 'similar' | 'different' {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return 'different';
  if ([...x].sort().join(' ') === [...y].sort().join(' ')) return 'same';
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const pool = [...long];
  for (const t of short) {
    const i = pool.findIndex((p) => p === t || (t.length === 1 && p.startsWith(t)) || (p.length === 1 && t.startsWith(p)));
    if (i < 0) return 'different';
    pool.splice(i, 1);
  }
  return 'similar';
}

export function checkDocument(doc: DocumentRecord, profile: ProfileState, now = Date.now()): DocCheck[] {
  const checks: DocCheck[] = [];
  const kindLabel = DOC_KINDS[doc.kind].label;

  /* 1. Readable */
  const read = doc.fields.filter((f) => f.value && f.legible).length;
  const unreadable = doc.fields.filter((f) => !f.legible).length;
  const issues = doc.quality.issues.length ? ` (${doc.quality.issues.join(', ')})` : '';
  if (read === 0 && doc.kind !== 'other') {
    checks.push({ id: 'readable', status: 'fail', label: 'Nothing could be read', detail: `Please re-scan: lay it flat in good light with all four corners visible${issues}.` });
  } else if (doc.quality.overall === 'poor' && unreadable >= read) {
    checks.push({ id: 'readable', status: 'fail', label: 'Too unclear to use', detail: `Most details could not be read${issues}. Offices also reject unclear copies — please re-scan.` });
  } else if (doc.quality.overall !== 'good' || unreadable > 0) {
    checks.push({
      id: 'readable',
      status: 'warn',
      label: `Scan quality: ${doc.quality.overall}`,
      detail: `${unreadable ? `${unreadable} detail(s) could not be read. ` : ''}A clearer scan avoids rejection${issues}.`,
    });
  } else {
    checks.push({ id: 'readable', status: 'pass', label: 'Clear scan', detail: `${read} detail(s) read${doc.quality.rotated ? ' (rotated page straightened)' : ''}.` });
  }

  /* 2. Right type */
  if (doc.requestedKind && doc.requestedKind !== doc.kind) {
    checks.push({
      id: 'type',
      status: 'warn',
      label: `This looks like a ${kindLabel}, not a ${DOC_KINDS[doc.requestedKind].label}`,
      detail: `It is being used as a ${kindLabel}. If that is wrong, upload the ${DOC_KINDS[doc.requestedKind].label} itself.`,
    });
  } else if (doc.kind === 'other') {
    checks.push({ id: 'type', status: 'warn', label: 'Not a recognised ID or certificate', detail: 'It only counts where other supporting documents are accepted.' });
  } else if (doc.kindConfidence < 0.6) {
    checks.push({ id: 'type', status: 'warn', label: `Probably a ${kindLabel}`, detail: 'The document type was hard to tell — check it is the right document.' });
  } else {
    checks.push({ id: 'type', status: 'pass', label: `Recognised as ${kindLabel}` });
  }

  /* 3. Number format */
  const rule = NUMBER_RULES[doc.kind];
  if (rule) {
    const field = doc.fields.find((f) => f.key === rule.key);
    const label = PROFILE_FIELD_MAP[rule.key].label;
    const v = field?.value ? field.value.replace(/[\s-]/g, '').toUpperCase() : '';
    if (!v) {
      checks.push({ id: 'number', status: 'warn', label: `${label} not read`, detail: 'Type it in below, or upload a clearer copy.' });
    } else if (rule.key === 'aadhaar') {
      if (field!.checksumOk === false) checks.push({ id: 'number', status: 'warn', label: 'Aadhaar number fails the checksum', detail: 'A digit was probably misread. Check it against your card.' });
      else if (field!.checksumOk) checks.push({ id: 'number', status: 'pass', label: 'Aadhaar number passes the checksum', detail: 'Only the last 4 digits are kept.' });
      else checks.push({ id: 'number', status: 'pass', label: 'Masked Aadhaar', detail: 'Only the last 4 digits are printed. Some offices want the full number — type it when downloading the form.' });
    } else if (rule.pattern && !rule.pattern.test(v)) {
      checks.push({ id: 'number', status: 'warn', label: `${label} format looks wrong`, detail: `"${field!.value}" should be ${rule.format}. A character may be misread, or it may be an older format.` });
    } else if (doc.kind === 'pan' && v[3] !== 'P') {
      checks.push({ id: 'number', status: 'fail', label: 'Not a personal PAN', detail: `This PAN belongs to ${PAN_HOLDER[v[3]] || 'a non-individual'}, so it cannot be used as your own ID.` });
    } else {
      checks.push({ id: 'number', status: 'pass', label: `${label} format is correct` });
    }
  }

  /* 4. Still valid */
  const expiry = toTime(doc.validity?.expiryDate);
  const issued = toTime(doc.validity?.issueDate);
  const minDays = EXPIRING[doc.kind];
  if (expiry !== null) {
    const daysLeft = Math.floor((expiry - now) / DAY);
    if (daysLeft < 0) {
      checks.push({ id: 'validity', status: 'fail', label: `Expired on ${doc.validity!.expiryDate}`, detail: 'An expired document is not accepted. Renew it first, or use another accepted document.' });
    } else if (minDays && daysLeft < minDays) {
      checks.push({ id: 'validity', status: 'warn', label: `Expires soon (${doc.validity!.expiryDate})`, detail: 'Many applications, including OCI, expect at least 6 months of validity left.' });
    } else {
      checks.push({ id: 'validity', status: 'pass', label: `Valid until ${doc.validity!.expiryDate}` });
    }
  } else if (minDays !== undefined) {
    checks.push({ id: 'validity', status: 'warn', label: 'Expiry date not found', detail: 'Make sure this document is still valid.' });
  }
  if (issued !== null) {
    const age = Math.floor((now - issued) / DAY);
    if (age < -1) checks.push({ id: 'issued', status: 'warn', label: `Issue date ${doc.validity!.issueDate} is in the future`, detail: 'It was probably misread — please check.' });
    else if (doc.kind === 'utility' && age > 92) checks.push({ id: 'issued', status: 'warn', label: `Bill is ${Math.round(age / 30)} months old`, detail: 'Many offices only accept a bill from the last few months as address proof.' });
    else if (doc.kind === 'income' && age > 365) checks.push({ id: 'issued', status: 'warn', label: 'Income certificate is over a year old', detail: 'Many States treat it as valid for one financial year — you may need a fresh one.' });
  }

  /* 5. Belongs to the applicant, and agrees with the other documents */
  const docName = value(doc, 'fullName');
  const applicant = profile.fields.fullName;
  if (docName && applicant && applicant.docId !== doc.id) {
    const match = compareNames(docName, applicant.value);
    if (match === 'different') {
      checks.push({
        id: 'holder',
        status: 'warn',
        label: 'Name differs from the applicant',
        detail: `This document says "${docName}", the application says "${applicant.value}". Fine for a parent’s document used as proof; otherwise use the applicant’s own document or get the name corrected.`,
      });
    } else {
      checks.push({ id: 'holder', status: 'pass', label: 'Name matches the applicant', detail: match === 'similar' ? `"${docName}" matches "${applicant.value}" (initials or a missing middle name).` : undefined });
    }
  } else if (docName && applicant?.docId === doc.id) {
    checks.push({ id: 'holder', status: 'pass', label: 'Applicant’s name is taken from this document' });
  }

  // Someone else's document is expected to differ, so only the applicant's own are compared
  const othersDocument = checks.some((c) => c.id === 'holder' && c.status !== 'pass');
  const mismatches: string[] = [];
  for (const key of othersDocument ? [] : (['dateOfBirth', 'gender'] as ProfileKey[])) {
    const mine = value(doc, key);
    const theirs = profile.fields[key];
    if (!mine || !theirs || theirs.docId === doc.id) continue;
    if (key === 'dateOfBirth' && /^\d{4}$/.test(mine)) continue;
    const a = key === 'dateOfBirth' ? normaliseDate(mine) || mine : mine.toLowerCase();
    const b = key === 'dateOfBirth' ? normaliseDate(theirs.value) || theirs.value : theirs.value.toLowerCase();
    if (a !== b) mismatches.push(`${PROFILE_FIELD_MAP[key].label}: ${mine} here, ${theirs.value} from ${theirs.sourceLabel}`);
  }
  if (mismatches.length) {
    checks.push({
      id: 'consistency',
      status: 'warn',
      label: 'Disagrees with your other details',
      detail: `${mismatches.join('; ')}. Applications are often rejected when documents disagree — get the wrong one corrected.`,
    });
  }

  /* 6. Aadhaar needs its address side to be address proof */
  if (doc.kind === 'aadhaar' && !value(doc, 'addressLine')) {
    checks.push({ id: 'sides', status: 'warn', label: 'Address side not found', detail: 'Upload the back of the card too if you want to use Aadhaar as proof of address.' });
  }

  return checks;
}

export const isUsable = (checks: DocCheck[]) => !checks.some((c) => c.status === 'fail');

/** Why a usable document still cannot meet a particular requirement, or null if it can. */
export function cannotMeet(doc: DocumentRecord, requirementId: string): string | null {
  if (requirementId === 'poa' && doc.kind === 'aadhaar' && !value(doc, 'addressLine')) return 'address side not uploaded';
  if (requirementId === 'pob' && !(value(doc, 'dateOfBirth') && /\d{2}\/\d{2}\/\d{4}/.test(value(doc, 'dateOfBirth')!))) return 'full date of birth not read';
  return null;
}
