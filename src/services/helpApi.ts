/** Client for Letter help (server/help/router.ts). Nothing sent here is stored. */
import type { UploadFile } from './autofillApi';

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/help${path}`, {
    method: 'POST',
    headers: { 'X-Udaan-Client': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as T;
}

export type LetterKind = 'rejection' | 'approval' | 'payment_due' | 'documents_needed' | 'visit_or_hearing' | 'legal_notice' | 'information' | 'possible_scam' | 'other';
export type ReplyKind = 'appeal' | 'grievance' | 'reply' | 'none';

export interface LetterOfficial {
  issuer?: string;
  officeAddress?: string;
  reference?: string;
  letterDate?: string;
  subject?: string;
  scheme?: string;
  addressedTo?: string;
  reasons?: string[];
  appealTo?: string;
}

export interface LetterReading {
  readable: boolean;
  kind: LetterKind;
  urgency: 'high' | 'medium' | 'low';
  title: string;
  from?: string;
  summary: string[];
  deadlines?: Array<{ what: string; date: string }>;
  actions: string[];
  reasons?: Array<{ reason: string; fix: string }>;
  warnings?: string[];
  canReply: boolean;
  replyKind: ReplyKind;
  readAloud: string;
  official: LetterOfficial;
}

export interface DraftLetter {
  to: string[];
  subject: string;
  reference?: string;
  salutation: string;
  body: string[];
  closing: string;
  enclosures?: string[];
  toFill?: string[];
  explain: string[];
  applicant: { name: string; address: string; phone: string };
  replyKind: ReplyKind;
}

export const helpApi = {
  readLetter: (input: { text?: string; files?: UploadFile[] }, language: string) => call<LetterReading>('/letter', { ...input, language }),
  draftReply: (input: { official: LetterOfficial; replyKind: ReplyKind; explanation: string; applicant: { name: string; address: string; phone: string } }, language: string) =>
    call<{ letter: DraftLetter }>('/appeal', { ...input, language }).then((r) => r.letter),
  async letterPdf(letter: DraftLetter): Promise<Blob> {
    const res = await fetch('/api/help/appeal/pdf', {
      method: 'POST',
      headers: { 'X-Udaan-Client': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ letter }),
    });
    if (!res.ok) throw new Error('Could not make the PDF. Please try again.');
    return res.blob();
  },
};

export const familyApi = {
  understand: (text: string) => call<{ household: import('../data/familySchemes').Household }>('/family', { text }).then((r) => r.household),
};
