import type { DocKind, ProfileKey } from '../../src/data/autofillSchema';

export type SourceKind = 'typed' | 'voice' | 'chat' | 'helpline' | 'document' | 'answer';

/**
 * self_declared — the person told us (typed, said or answered).
 * extracted     — read from an uploaded document by OCR; not independently verified.
 * confirmed     — the person reviewed the value and confirmed or corrected it.
 * No value is ever "verified" by UDAAN ONE: there is no government verification integration.
 */
export type FieldStatus = 'self_declared' | 'extracted' | 'confirmed';

export interface FieldRecord {
  value: string;
  source: SourceKind;
  sourceLabel: string;
  status: FieldStatus;
  docId?: string;
  confidence?: number;
  /** Other sources that gave the same value. */
  corroboratedBy?: string[];
  /** Aadhaar only: whether the full number passed the Verhoeff checksum when read. */
  checksumOk?: boolean;
  updatedAt: number;
}

export interface Candidate {
  value: string;
  source: SourceKind;
  sourceLabel: string;
  status: FieldStatus;
  docId?: string;
  confidence?: number;
  checksumOk?: boolean;
}

export interface Conflict {
  id: string;
  key: ProfileKey;
  candidates: Candidate[];
}

export interface ProfileState {
  fields: Partial<Record<ProfileKey, FieldRecord>>;
  conflicts: Conflict[];
}

export interface ExtractedField {
  key: ProfileKey;
  value: string | null;
  confidence: number;
  legible: boolean;
  note?: string;
  checksumOk?: boolean;
  /** True when the value was merged into the profile automatically. */
  merged: boolean;
}

export interface DocumentRecord {
  id: string;
  kind: DocKind;
  kindConfidence: number;
  label: string;
  fileNames: string[];
  pageCount: number;
  quality: { overall: 'good' | 'fair' | 'poor'; rotated: boolean; issues: string[] };
  fields: ExtractedField[];
  extraFields: Array<{ label: string; value: string }>;
  /** Dates printed on the document (DD/MM/YYYY): issue / bill date and expiry. */
  validity?: { issueDate?: string; expiryDate?: string };
  /** The type the person said they were uploading, if they chose one. */
  requestedKind?: DocKind;
  uploadedAt: number;
  /** Original files are discarded after extraction; only these fields are kept. */
  originalRetained: false;
}

/** One automatic check on an uploaded document. 'fail' means it cannot be used for the application. */
export interface DocCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  label: string;
  detail?: string;
}

export interface Placement {
  fieldKey: string;
  page: number;
  /** Normalised 0–1000 box [ymin, xmin, ymax, xmax] where the answer is written. */
  box: [number, number, number, number];
}

export interface OfficialForm {
  name: string;
  kind: 'acroform' | 'scanned';
  mime: string;
  bytesB64: string;
  /** acroform: PDF field name → our field key (or null if we cannot fill it). */
  fieldMap?: Record<string, string | null>;
  placements?: Placement[];
  unplaced?: string[];
  uploadedAt: number;
}

export interface Draft {
  id: string;
  reference: string;
  pinHash?: string;
  schemeId: string;
  createdAt: number;
  updatedAt: number;
  channels: Array<{ channel: string; at: number }>;
  /** Scheme-specific answers that do not belong in the shared profile. */
  answers: Record<string, FieldRecord>;
  approval?: { at: number; fieldsHash: string };
  generated?: { at: number; kind: 'draft_pdf' | 'official_acroform' | 'official_overlay' };
  officialForm?: OfficialForm;
}

/**
 * The applicant's passport-size photo, printed on every form. Unlike documents it has to be
 * kept (encrypted, with the rest of the session) so it can be placed on the PDF.
 */
export interface ApplicantPhoto {
  mime: 'image/jpeg' | 'image/png';
  dataB64: string;
  width: number;
  height: number;
  checks: DocCheck[];
  uploadedAt: number;
}

export interface SessionData {
  hash: string;
  createdAt: number;
  lastSeen: number;
  consent?: { version: string; at: number };
  /** The signed-in account these details belong to (when sign-in is switched on). */
  userId?: string;
  profile: ProfileState;
  documents: DocumentRecord[];
  photo?: ApplicantPhoto;
  drafts: Draft[];
  /** Learning Hub certificates earned by this person. */
  certificates?: import('../learn/certificates').Certificate[];
  /** Learning Hub progress (subtopic keys done) and the courses Guru built for this person. */
  learning?: { progress: string[]; courses: unknown[] };
  /** Schemes this person saved to look at later (scheme ids). */
  savedSchemes?: string[];
  /** Career roadmaps made for this person, newest first. */
  roadmaps?: Array<{ id: string; createdAt: number; roadmap: unknown }>;
}
