/**
 * Universal autofill engine: maps the shared profile and per-application answers onto a
 * scheme's form fields, then validates the result and lists what is still needed.
 */
import crypto from 'crypto';
import { DOC_KINDS, FORM_SCHEMA_MAP, PROFILE_FIELD_MAP, requirementsFor, type FormFieldSpec, type SchemeFormSchema } from '../../src/data/autofillSchema';
import { DOCUMENT_SERVICES } from '../../src/data/documentServices';
import { SCHEME_CATALOG } from '../../src/data/schemeCatalog';
import { cannotMeet, checkDocument, isUsable } from './checks';
import type { Draft, FieldRecord, SessionData } from './types';
import { ageFromDob, checkValue, normaliseMoney } from './validate';
import { eligibilityFor, schemeInfo } from './schemes';

export type FieldState = 'filled' | 'review' | 'missing' | 'conflict' | 'invalid';

export interface FieldView {
  key: string;
  label: string;
  labelHi?: string;
  section: string;
  type: string;
  options?: string[];
  required: boolean;
  value: string;
  state: FieldState;
  source?: string;
  sourceLabel?: string;
  status?: FieldRecord['status'];
  confidence?: number;
  corroboratedBy?: string[];
  checksumOk?: boolean;
  issues: string[];
  question?: string;
  questionHi?: string;
  help?: string;
  sensitive?: boolean;
}

/** Below this OCR confidence a value is filled in but flagged for the person to check. */
export const REVIEW_CONFIDENCE = 0.85;

function recordFor(session: SessionData, draft: Draft, spec: FormFieldSpec): FieldRecord | undefined {
  if (spec.profileKey) return session.profile.fields[spec.profileKey];
  if (draft.answers[spec.key] || !spec.fromDoc) return draft.answers[spec.key];
  // Dates printed on an uploaded document (e.g. passport expiry) fill the field until answered
  const { kinds, attr } = spec.fromDoc;
  const doc = [...session.documents].reverse().find((d) => kinds.includes(d.kind) && d.validity?.[attr]);
  return doc
    ? { value: doc.validity![attr]!, source: 'document', sourceLabel: doc.label, status: 'extracted', docId: doc.id, confidence: 0.9, updatedAt: doc.uploadedAt }
    : undefined;
}

export function buildFields(session: SessionData, draft: Draft): FieldView[] {
  const schema = FORM_SCHEMA_MAP[draft.schemeId];
  if (!schema) return [];
  const conflictKeys = new Set(session.profile.conflicts.map((c) => c.key));

  const views = schema.fields.map((spec): FieldView => {
    const rec = recordFor(session, draft, spec);
    const def = spec.profileKey ? PROFILE_FIELD_MAP[spec.profileKey] : undefined;
    const issues: string[] = [];
    let state: FieldState;
    const value = rec?.value || '';

    if (spec.profileKey && conflictKeys.has(spec.profileKey)) {
      state = 'conflict';
      issues.push('Your documents or answers give different values — choose the right one.');
    } else if (!value) {
      state = 'missing';
    } else {
      const problem = checkValue(spec.type, value, spec.options, spec.profileKey === 'dateOfBirth');
      if (problem) {
        state = 'invalid';
        issues.push(problem);
      } else if (rec && rec.status === 'extracted' && (rec.confidence ?? 1) < REVIEW_CONFIDENCE) {
        state = 'review';
        issues.push('Read from your document with low certainty — please check it.');
      } else {
        state = 'filled';
      }
      const m = spec.fromDoc?.attr === 'expiryDate' ? value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
      if (m && new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() < Date.now()) {
        state = 'review';
        issues.push('This date has passed — the document has expired. Renew it before applying.');
      }
      if (spec.type === 'aadhaar' && rec?.checksumOk === false) {
        state = 'review';
        issues.push('The Aadhaar number read did not pass the checksum — please check your card.');
      }
    }

    return {
      key: spec.key,
      label: spec.label,
      labelHi: spec.labelHi,
      section: spec.section,
      type: spec.type,
      options: spec.options,
      required: spec.required,
      value,
      state,
      source: rec?.source,
      sourceLabel: rec?.sourceLabel,
      status: rec?.status,
      confidence: rec?.confidence,
      corroboratedBy: rec?.corroboratedBy,
      checksumOk: rec?.checksumOk,
      issues,
      question: spec.question || def?.question,
      questionHi: spec.questionHi || def?.questionHi,
      help: spec.help,
      sensitive: def?.sensitive,
    };
  });

  applyCrossChecks(views, draft.schemeId);
  return views;
}

/** Logical checks that involve more than one field. */
function applyCrossChecks(views: FieldView[], schemeId: string) {
  const get = (k: string) => views.find((v) => v.key === k);
  const num = (k: string) => {
    const v = get(k)?.value;
    const n = v ? Number(normaliseMoney(v)) : NaN;
    return isFinite(n) ? n : NaN;
  };
  const flag = (k: string, msg: string) => {
    const v = get(k);
    if (v && v.value) {
      v.issues.push(msg);
      if (v.state === 'filled') v.state = 'review';
    }
  };

  const cost = num('projectCost');
  if (!isNaN(cost)) {
    if (num('loanAmount') > cost) flag('loanAmount', 'The loan is larger than the project cost.');
    if (num('bankLoan') > cost) flag('bankLoan', 'The bank loan is larger than the project cost.');
  }

  const dob = get('dateOfBirth')?.value;
  const catalog = [...SCHEME_CATALOG, ...DOCUMENT_SERVICES].find((s) => s.id === schemeId);
  if (dob && catalog) {
    const age = ageFromDob(dob);
    if (age !== null && catalog.rules.minAge !== undefined && age < catalog.rules.minAge) flag('dateOfBirth', `This scheme's minimum age is ${catalog.rules.minAge}.`);
    if (age !== null && catalog.rules.maxAge !== undefined && age > catalog.rules.maxAge) flag('dateOfBirth', `This scheme's maximum age is ${catalog.rules.maxAge}.`);
  }

  const cat = get('socialCategory');
  if (cat?.value && catalog?.rules.scOnly && !/^sc$|scheduled caste/i.test(cat.value)) {
    flag('socialCategory', 'This scheme is for Scheduled Caste applicants.');
  }
}

export interface RequirementView {
  id: string;
  /** First document kind that satisfies it — used as the upload hint. */
  kind: string;
  label: string;
  labelHi?: string;
  required: boolean;
  have: boolean;
  docIds: string[];
  /** Labels of the uploaded documents that satisfy this requirement. */
  satisfiedBy: string[];
  /** Uploaded documents of an accepted type that cannot be used, and why. */
  rejected: Array<{ docId: string; label: string; reason: string }>;
  /** Everything commonly accepted for it. */
  accepted: string[];
  /** Cannot be read automatically (photo, signature, medical form). */
  manual: boolean;
  note?: string;
}

export interface DraftView {
  id: string;
  reference: string;
  hasPin: boolean;
  schemeId: string;
  scheme: ReturnType<typeof schemeInfo>;
  fields: FieldView[];
  sections: string[];
  missing: FieldView[];
  needsReview: FieldView[];
  conflicts: SessionData['profile']['conflicts'];
  documents: RequirementView[];
  completion: number;
  readyForApproval: boolean;
  approved: boolean;
  approvalStale: boolean;
  generated?: Draft['generated'];
  officialForm?: { name: string; kind: string; fillable: number; total: number; unplaced: string[] };
  eligibility: ReturnType<typeof eligibilityFor>;
  status: { code: string; label: string; detail: string };
  nextSteps: string[];
  channels: Draft['channels'];
  updatedAt: number;
}

export function fieldsHash(fields: FieldView[]): string {
  return crypto.createHash('sha256').update(JSON.stringify(fields.map((f) => [f.key, f.value]))).digest('hex');
}

export function buildDraftView(session: SessionData, draft: Draft): DraftView {
  const schema = FORM_SCHEMA_MAP[draft.schemeId] as SchemeFormSchema;
  const fields = buildFields(session, draft);
  const required = fields.filter((f) => f.required);
  const missing = fields.filter((f) => (f.required && (f.state === 'missing' || f.state === 'invalid')) || (!f.required && f.state === 'invalid'));
  const needsReview = fields.filter((f) => f.state === 'review');
  const conflicts = session.profile.conflicts.filter((c) => fields.some((f) => f.key === c.key));
  const done = required.filter((f) => f.state === 'filled' || f.state === 'review').length;
  const completion = required.length ? Math.round((done / required.length) * 100) : 100;
  const readyForApproval = missing.length === 0 && conflicts.length === 0;
  const hash = fieldsHash(fields);
  const approved = Boolean(draft.approval && draft.approval.fieldsHash === hash);
  const approvalStale = Boolean(draft.approval && !approved);

  const checked = new Map(session.documents.map((d) => [d.id, checkDocument(d, session.profile)]));
  const documents: RequirementView[] = requirementsFor(schema).map((r) => {
    const candidates = session.documents.filter((d) => r.anyOf.includes(d.kind));
    const rejected: RequirementView['rejected'] = [];
    const docs = candidates.filter((d) => {
      const failed = checked.get(d.id)!.find((c) => c.status === 'fail');
      const reason = failed ? failed.label.toLowerCase() : cannotMeet(d, r.id);
      if (reason) rejected.push({ docId: d.id, label: d.label, reason });
      return !reason && isUsable(checked.get(d.id)!);
    });
    const readable = r.anyOf.filter((k) => !(k === 'other' && r.alsoAccepted?.length)).map((k) => DOC_KINDS[k].label);
    return {
      id: r.id,
      kind: r.anyOf[0] || r.id,
      label: r.label,
      labelHi: r.labelHi,
      required: r.required,
      have: docs.length > 0,
      docIds: docs.map((d) => d.id),
      satisfiedBy: Array.from(new Set(docs.map((d) => d.label))),
      rejected,
      accepted: [...readable, ...(r.alsoAccepted || [])],
      manual: Boolean(r.manual),
      note: r.note,
    };
  });

  const info = schemeInfo(draft.schemeId);
  const status = draft.generated
    ? { code: 'prepared', label: 'Prepared — not submitted', detail: 'Your filled application is ready to download. UDAAN ONE has not submitted it anywhere.' }
    : approved
      ? { code: 'approved', label: 'Approved by you — ready to download', detail: 'You checked and approved these details.' }
      : readyForApproval
        ? { code: 'review', label: 'Ready for your review', detail: 'All required details are filled. Check them and approve.' }
        : { code: 'collecting', label: 'Collecting details', detail: `${missing.length} detail(s) still needed${conflicts.length ? `, ${conflicts.length} to confirm` : ''}.` };

  const nextSteps = [
    `Submit through: ${schema.submission.where} (${schema.submission.url}). UDAAN ONE has no authorised submission link for this scheme, so it cannot submit for you.`,
    'Take the original documents with you — the office will verify them. Reading a document here does not verify it.',
    ...(info?.steps || []).slice(0, 3),
    'Keep the acknowledgement or application number the office or portal gives you.',
  ];

  const of = draft.officialForm;
  return {
    id: draft.id,
    reference: draft.reference,
    hasPin: Boolean(draft.pinHash),
    schemeId: draft.schemeId,
    scheme: info,
    fields,
    sections: Array.from(new Set(fields.map((f) => f.section))),
    missing,
    needsReview,
    conflicts,
    documents,
    completion,
    readyForApproval,
    approved,
    approvalStale,
    generated: draft.generated,
    officialForm: of
      ? {
          name: of.name,
          kind: of.kind,
          fillable: of.kind === 'acroform' ? Object.values(of.fieldMap || {}).filter(Boolean).length : (of.placements || []).length,
          total: of.kind === 'acroform' ? Object.keys(of.fieldMap || {}).length : (of.placements || []).length + (of.unplaced || []).length,
          unplaced: of.unplaced || [],
        }
      : undefined,
    eligibility: eligibilityFor(draft.schemeId, session.profile),
    status,
    nextSteps,
    channels: draft.channels,
    updatedAt: draft.updatedAt,
  };
}
