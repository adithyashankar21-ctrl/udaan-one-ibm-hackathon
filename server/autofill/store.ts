/**
 * Encrypted, short-lived storage for Smart Apply sessions.
 *
 * - Each session is one AES-256-GCM encrypted file; the file name is a hash of the
 *   session token, so the token itself never touches disk.
 * - Original documents are never stored here, only the extracted fields.
 * - Sessions untouched for RETENTION_DAYS are deleted automatically.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SessionData } from './types';

export const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

const dataDir = path.join(process.cwd(), '.data');
const sessionDir = path.join(dataDir, 'sessions');
const refDir = path.join(dataDir, 'refs');
const keyFile = path.join(dataDir, '.key');

function ensureDirs() {
  for (const d of [dataDir, sessionDir, refDir]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  }
}

function loadKey(): Buffer {
  const fromEnv = process.env.UDAAN_DATA_KEY;
  if (fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv)) return Buffer.from(fromEnv, 'hex');
  ensureDirs();
  if (fs.existsSync(keyFile)) return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  console.log('[autofill] Generated a local data-encryption key in .data/.key (set UDAAN_DATA_KEY in production).');
  return key;
}

const KEY = loadKey();

function encrypt(plain: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8');
}

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const sessionPath = (sessionHash: string) => path.join(sessionDir, `${sessionHash}.enc`);

export function newSession(): { token: string; data: SessionData } {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const data: SessionData = {
    hash: hashToken(token),
    createdAt: now,
    lastSeen: now,
    profile: { fields: {}, conflicts: [] },
    documents: [],
    drafts: [],
  };
  return { token, data };
}

export function loadSession(sessionHash: string): SessionData | null {
  try {
    const file = sessionPath(sessionHash);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(decrypt(fs.readFileSync(file))) as SessionData;
    if (Date.now() - data.lastSeen > RETENTION_MS) {
      deleteSession(data);
      return null;
    }
    return data;
  } catch {
    // Tampered or unreadable (for example after a key change) — treat as absent
    return null;
  }
}

export function saveSession(data: SessionData) {
  ensureDirs();
  data.lastSeen = Date.now();
  fs.writeFileSync(sessionPath(data.hash), encrypt(JSON.stringify(data)), { mode: 0o600 });
}

export function deleteSession(data: SessionData) {
  for (const d of data.drafts) removeReference(d.reference);
  try {
    fs.rmSync(sessionPath(data.hash), { force: true });
  } catch {}
}

/* ── Application references (for resuming through the helpline) ───────── */

const refPath = (reference: string) => path.join(refDir, `${hashToken(reference.toUpperCase())}.enc`);

export function saveReference(reference: string, sessionHash: string, draftId: string) {
  ensureDirs();
  fs.writeFileSync(refPath(reference), encrypt(JSON.stringify({ sessionHash, draftId })), { mode: 0o600 });
}

export function lookupReference(reference: string): { sessionHash: string; draftId: string } | null {
  try {
    const file = refPath(reference);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(decrypt(fs.readFileSync(file)));
  } catch {
    return null;
  }
}

export function removeReference(reference: string) {
  try {
    fs.rmSync(refPath(reference), { force: true });
  } catch {}
}

/** Delete sessions that have not been used within the retention window. */
export function sweepExpired() {
  ensureDirs();
  for (const file of fs.readdirSync(sessionDir)) {
    const full = path.join(sessionDir, file);
    try {
      const data = JSON.parse(decrypt(fs.readFileSync(full))) as SessionData;
      if (Date.now() - data.lastSeen > RETENTION_MS) deleteSession(data);
    } catch {
      fs.rmSync(full, { force: true });
    }
  }
}

/* ── PINs ──────────────────────────────────────────────────────────────── */

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pin, salt, 32);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const derived = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), 32);
  return crypto.timingSafeEqual(derived, Buffer.from(hashHex, 'hex'));
}

/** Human-friendly reference without look-alike characters, e.g. UD-7K3P-Q9WM. */
export function newReference(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join('');
  return `UD-${pick(4)}-${pick(4)}`;
}
