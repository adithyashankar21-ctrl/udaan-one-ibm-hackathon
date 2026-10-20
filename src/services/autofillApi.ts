/**
 * Client for the Smart Apply & Autofill API. All personal data lives on the server
 * (encrypted, short-lived); the browser only holds an HttpOnly session cookie.
 */
import type { BeneficiaryProfile } from '../types';
import type { ProfileKey } from '../data/autofillSchema';

const BASE = '/api/autofill';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(BASE + path, {
    credentials: 'same-origin',
    ...rest,
    headers: { 'X-Udaan-Client': '1', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers || {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ── Types mirrored from the server ─────────────────────────────────── */

export interface FieldInfo {
  value: string;
  source: string;
  sourceLabel: string;
  status: 'self_declared' | 'extracted' | 'confirmed';
  confidence?: number;
  corroboratedBy: string[];
  checksumOk?: boolean;
}

export interface Candidate {
  value: string;
  source: string;
  sourceLabel: string;
  status: string;
  confidence?: number;
}

export interface Conflict {
  id: string;
  key: ProfileKey;
  candidates: Candidate[];
}

export interface ExtractedField {
  key: ProfileKey;
  value: string | null;
  confidence: number;
  legible: boolean;
  note?: string;
  checksumOk?: boolean;
  merged: boolean;
}

export interface DocRecord {
  id: string;
  kind: string;
  kindConfidence: number;
  label: string;
  fileNames: string[];
  pageCount: number;
  quality: { overall: 'good' | 'fair' | 'poor'; rotated: boolean; issues: string[] };
  fields: ExtractedField[];
  extraFields: Array<{ label: string; value: string }>;
  validity?: { issueDate?: string; expiryDate?: string };
  requestedKind?: string;
  /** Automatic checks; a 'fail' means the document does not count towards any application. */
  checks: DocCheck[];
  usable: boolean;
  uploadedAt: number;
}

export interface DocCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  label: string;
  detail?: string;
}

export interface DraftSummary {
  id: string;
  schemeId: string;
  schemeName: string;
  status: { code: string; label: string; detail: string };
  completion: number;
  missingCount: number;
  conflictCount: number;
  reviewCount: number;
  docsRequired: number;
  docsHave: number;
  missingDocs: string[];
  reference: string;
  updatedAt: number;
}

export interface SessionState {
  hasSession: boolean;
  consent: { version: string; at: number } | null;
  consentVersion: string;
  retentionDays: number;
  profile?: { fields: Partial<Record<ProfileKey, FieldInfo>>; conflicts: Conflict[] };
  documents?: DocRecord[];
  /** The applicant's photo (shared by all applications); the image itself comes from photoBlob(). */
  photo?: { checks: DocCheck[]; usable: boolean; width: number; height: number; uploadedAt: number } | null;
  drafts?: DraftSummary[];
}

export interface SchemeInfo {
  schemeId: string;
  kind: 'scheme' | 'document';
  category?: string;
  officialForm?: string;
  online?: string;
  name: string;
  ministry: string;
  summary: string;
  keySupport: string[];
  eligibilitySummary: string;
  documents: string[];
  steps: string[];
  officialUrl: string;
  officialLabel: string;
  formTitle: string;
  basis: string;
  submission: { mode: string; where: string; url: string; integration: 'none' };
  requiredDocs: string[];
  optionalDocs: string[];
  eligibility?: { level: 'likely' | 'needs-info' | 'unlikely'; reasons: string[] };
}

export interface FieldView {
  key: string;
  label: string;
  labelHi?: string;
  section: string;
  type: string;
  options?: string[];
  required: boolean;
  value: string;
  state: 'filled' | 'review' | 'missing' | 'conflict' | 'invalid';
  source?: string;
  sourceLabel?: string;
  status?: FieldInfo['status'];
  confidence?: number;
  corroboratedBy?: string[];
  checksumOk?: boolean;
  issues: string[];
  question?: string;
  questionHi?: string;
  help?: string;
  sensitive?: boolean;
  /** Missing, but these not-yet-uploaded documents would fill it. */
  fillableBy?: string[];
}

export interface RequirementView {
  id: string;
  kind: string;
  label: string;
  labelHi?: string;
  required: boolean;
  have: boolean;
  docIds: string[];
  satisfiedBy: string[];
  rejected: Array<{ docId: string; label: string; reason: string }>;
  warnings: string[];
  accepted: string[];
  manual: boolean;
  note?: string;
}

export interface DraftView {
  id: string;
  reference: string;
  hasPin: boolean;
  schemeId: string;
  scheme: SchemeInfo;
  fields: FieldView[];
  sections: string[];
  missing: FieldView[];
  needsReview: FieldView[];
  conflicts: Conflict[];
  documents: RequirementView[];
  completion: number;
  readyForApproval: boolean;
  approved: boolean;
  approvalStale: boolean;
  generated?: { at: number; kind: string };
  officialForm?: { name: string; kind: 'acroform' | 'scanned'; fillable: number; total: number; unplaced: string[] };
  eligibility: { level: 'likely' | 'needs-info' | 'unlikely'; reasons: string[] } | null;
  status: { code: string; label: string; detail: string };
  nextSteps: string[];
  channels: Array<{ channel: string; at: number }>;
  updatedAt: number;
}

export interface UploadFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}

/* ── Calls ──────────────────────────────────────────────────────────── */

export const autofillApi = {
  session: () => call<SessionState>('/session'),
  consent: (version: string) => call<SessionState>('/consent', { method: 'POST', json: { granted: true, version } }),
  deleteAll: () => call('/session', { method: 'DELETE', json: {} }),

  schemes: () => call<{ schemes: SchemeInfo[] }>('/schemes'),
  intent: (text: string) =>
    call<{ wantsToApply: boolean; schemeId: string | null; scheme: SchemeInfo | null; relatedSchemes: SchemeInfo[]; reason: string; matchedBy: string }>('/intent', { method: 'POST', json: { text } }),
  recommend: () => call<{ recommendations: SchemeInfo[]; note: string }>('/recommend'),

  updateProfile: (updates: Partial<Record<ProfileKey, string>>, source: string, confirm = false) =>
    call<SessionState & { errors: Record<string, string> }>('/profile', { method: 'POST', json: { updates, source, confirm } }),
  resolveConflict: (conflictId: string, choice: { index?: number; value?: string }) =>
    call<SessionState>('/profile/resolve', { method: 'POST', json: { conflictId, ...choice } }),

  uploadDocument: (files: UploadFile[], hint?: string) => call<SessionState & { document: DocRecord }>('/documents', { method: 'POST', json: { files, hint } }),
  confirmDocument: (id: string, values: Record<string, string>) =>
    call<SessionState & { errors: Record<string, string> }>(`/documents/${id}/confirm`, { method: 'POST', json: { values } }),
  deleteDocument: (id: string) => call<SessionState>(`/documents/${id}`, { method: 'DELETE', json: {} }),

  uploadPhoto: (file: UploadFile) => call<SessionState>('/photo', { method: 'POST', json: { files: [file] } }),
  deletePhoto: () => call<SessionState>('/photo', { method: 'DELETE', json: {} }),
  async photoBlob(): Promise<Blob | null> {
    const res = await fetch(`${BASE}/photo`, { credentials: 'same-origin' });
    return res.ok ? res.blob() : null;
  },

  startDraft: (schemeId: string, channel: string) => call<SessionState & { draft: DraftView }>('/drafts', { method: 'POST', json: { schemeId, channel } }),
  getDraft: (id: string) => call<{ draft: DraftView; fieldsHash: string }>(`/drafts/${id}`),
  deleteDraft: (id: string) => call<SessionState>(`/drafts/${id}`, { method: 'DELETE', json: {} }),
  answer: (id: string, key: string, text: string, channel: string) =>
    call<{ result: { ok: boolean; value?: string; error?: string }; draft: DraftView; fieldsHash: string }>(`/drafts/${id}/answer`, { method: 'POST', json: { key, text, channel } }),
  editFields: (id: string, values: Record<string, string>) =>
    call<SessionState & { errors: Record<string, string>; draft: DraftView; fieldsHash: string }>(`/drafts/${id}/fields`, { method: 'POST', json: { values } }),
  approve: (id: string, fieldsHash: string) => call<{ draft: DraftView; fieldsHash: string }>(`/drafts/${id}/approve`, { method: 'POST', json: { fieldsHash } }),
  uploadOfficialForm: (id: string, file: UploadFile) => call<{ draft: DraftView }>(`/drafts/${id}/official-form`, { method: 'POST', json: { files: [file] } }),
  removeOfficialForm: (id: string) => call<{ draft: DraftView }>(`/drafts/${id}/official-form`, { method: 'DELETE', json: {} }),
  setPin: (id: string, pin: string) => call<{ reference: string; hasPin: boolean }>(`/drafts/${id}/pin`, { method: 'POST', json: { pin } }),

  async downloadPdf(id: string, opts: { use: 'draft' | 'official'; aadhaarFull?: string }): Promise<void> {
    const res = await fetch(`${BASE}/drafts/${id}/pdf`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Udaan-Client': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, data.error || 'Could not create the PDF');
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'UDAAN_ONE_application.pdf';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  helpline: {
    resume: (reference: string, pin: string) => call<{ token: string }>('/helpline/resume', { method: 'POST', json: { reference, pin } }),
    draft: (token: string) => call<HelplineView>('/helpline/draft', { headers: { 'X-Helpline-Token': token } }),
    answer: (token: string, key: string, text: string) =>
      call<HelplineView & { ok: boolean; error?: string }>('/helpline/answer', { method: 'POST', json: { key, text }, headers: { 'X-Helpline-Token': token } }),
  },
};

export interface HelplineView {
  reference: string;
  schemeName: string;
  status: { code: string; label: string; detail: string };
  completion: number;
  conflicts: number;
  missing: Array<{ key: string; label: string; labelHi?: string; question?: string; questionHi?: string; type: string; options?: string[] }>;
  nextSteps: string[];
}

/* ── Bridging the app's existing profile shape ──────────────────────── */

const BRIDGE: Array<[ProfileKey, keyof BeneficiaryProfile]> = [
  ['fullName', 'name'],
  ['dateOfBirth', 'dateOfBirth'],
  ['gender', 'gender'],
  ['fatherSpouseName', 'fatherSpouseName'],
  ['mobile', 'phoneNumber'],
  ['addressLine', 'residentialAddress'],
  ['district', 'district'],
  ['state', 'state'],
  ['pincode', 'pincode'],
  ['aadhaar', 'aadhaarNumber'],
  ['socialCategory', 'socialCategory'],
  ['subCaste', 'subCaste'],
  ['annualFamilyIncome', 'annualFamilyIncome'],
  ['education', 'education'],
  ['occupation', 'currentOccupation'],
  ['existingSkills', 'existingSkills'],
  ['bankAccountNumber', 'bankAccountNumber'],
  ['bankIfsc', 'bankIfscCode'],
  ['bankName', 'bankName'],
  ['rationCardNumber', 'bplRationCardNumber'],
];

/** App profile changes → autofill profile updates (skips defaults and empty values). */
export function toAutofillUpdates(partial: Partial<BeneficiaryProfile>): Partial<Record<ProfileKey, string>> {
  const out: Partial<Record<ProfileKey, string>> = {};
  for (const [pk, bk] of BRIDGE) {
    const v = partial[bk];
    if (v === undefined || v === null || v === '' || typeof v === 'boolean') continue;
    if (bk === 'gender' && v === 'Prefer not to say') continue;
    let s = String(v).trim();
    if (pk === 'socialCategory' && /scheduled caste/i.test(s)) s = 'SC';
    if (s) out[pk] = s;
  }
  return out;
}

/** Autofill profile → fields for the app's existing profile (masked Aadhaar only). */
export function toBeneficiaryPartial(fields: Partial<Record<ProfileKey, FieldInfo>> | undefined): Partial<BeneficiaryProfile> {
  const out: Partial<BeneficiaryProfile> = {};
  for (const [pk, bk] of BRIDGE) {
    const f = fields?.[pk];
    if (!f?.value) continue;
    (out as any)[bk] = pk === 'socialCategory' && f.value === 'SC' ? 'Scheduled Caste (SC)' : f.value;
  }
  if (out.currentOccupation && !out.traditionalTrade) out.traditionalTrade = out.currentOccupation;
  if (out.annualFamilyIncome) out.householdIncome = out.annualFamilyIncome;
  return out;
}

/* ── Apply-intent event: any channel can hand off to Smart Apply ────── */

export const APPLY_INTENT_EVENT = 'udaan:apply-intent';

export interface ApplyIntentDetail {
  schemeId: string | null;
  channel: string;
  text?: string;
}

export function announceApplyIntent(detail: ApplyIntentDetail) {
  window.dispatchEvent(new CustomEvent<ApplyIntentDetail>(APPLY_INTENT_EVENT, { detail }));
}
