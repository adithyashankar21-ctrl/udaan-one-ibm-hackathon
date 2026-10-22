/**
 * UDAAN ONE certificates of completion for Learning Hub courses (curated, custom and NSQF job
 * roles learnt in the hub). A course is certified after all its topics are done and its final
 * assessment is passed. Passing an assessment gives a one-time pass, which the learner's
 * account turns into a certificate; anyone can check a certificate by its ID.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const PASS_MARK = 0.7;

export interface CoursePass {
  courseId: string;
  courseTitle: string;
  modules: string[];
  duration?: string;
  score: number;
  total: number;
  expires: number;
}

export interface Certificate {
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
  modules: string[];
  duration?: string;
  score: number;
  total: number;
  issuedAt: number;
}

const passes = new Map<string, CoursePass>();

/** A one-time pass for a passed assessment (valid for an hour). */
export function issuePass(p: Omit<CoursePass, 'expires'>): string {
  const token = crypto.randomBytes(18).toString('base64url');
  passes.set(token, { ...p, expires: Date.now() + 60 * 60 * 1000 });
  return token;
}

/** Use a pass (once). */
export function takePass(token: string): CoursePass | null {
  const p = passes.get(token);
  passes.delete(token);
  return p && p.expires > Date.now() ? p : null;
}

const dir = path.join(process.cwd(), '.data', 'certificates');
const LETTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newCertificateId(): string {
  const bytes = crypto.randomBytes(8);
  const code = [...bytes].map((b) => LETTERS[b % LETTERS.length]).join('');
  return `UO-${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Kept apart from the learner's private details so the certificate can be checked by anyone. */
export function savePublicCertificate(c: Certificate) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, `${c.id}.json`), JSON.stringify(c), { mode: 0o600 });
}

export function loadPublicCertificate(id: string): Certificate | null {
  if (!/^UO-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}
