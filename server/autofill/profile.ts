/**
 * Unified beneficiary profile: one value per field, with where it came from and how
 * trustworthy it is. Conflicting values are never silently overwritten — they become a
 * conflict the person resolves.
 */
import crypto from 'crypto';
import { PROFILE_FIELD_MAP, type ProfileKey } from '../../src/data/autofillSchema';
import type { Candidate, FieldRecord, ProfileState } from './types';
import { normalise, normaliseDate, normaliseMoney } from './validate';

/** Comparable form of a value, so "RAMESH  Kumar" and "Ramesh Kumar" count as the same. */
export function comparable(key: ProfileKey, value: string): string {
  const type = PROFILE_FIELD_MAP[key]?.type;
  const v = value.trim();
  if (type === 'date') return normaliseDate(v) || v;
  if (type === 'money') return normaliseMoney(v) || v;
  if (type === 'aadhaar') return v.replace(/\D/g, '').slice(-4);
  if (key === 'socialCategory') {
    if (/scheduled\s*caste|^sc$|अनुसूचित जाति/i.test(v)) return 'sc';
    if (/scheduled\s*tribe|^st$|अनुसूचित जनजाति/i.test(v)) return 'st';
    if (/other backward|^obc/i.test(v)) return 'obc';
  }
  return v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(s o|d o|w o|c o)\b/g, '')
    .trim();
}

/** Stronger statuses win ties: confirmed > extracted > self_declared. */
const rank = { self_declared: 0, extracted: 1, confirmed: 2 } as const;

const SELF = new Set(['typed', 'voice', 'chat', 'helpline', 'answer']);

export interface MergeResult {
  changed: boolean;
  conflict: boolean;
}

/**
 * Merge one candidate value into the profile.
 * - New field → stored.
 * - Same value → kept, the new source is recorded as corroboration (and status may rise).
 * - Different value:
 *     · if both are the person's own statements, the newer one is a self-correction;
 *     · if the person explicitly confirms (status 'confirmed'), it wins;
 *     · otherwise a conflict is opened for the person to resolve.
 */
export function mergeCandidate(profile: ProfileState, key: ProfileKey, cand: Candidate): MergeResult {
  if (!cand.value || !cand.value.trim()) return { changed: false, conflict: false };
  const existing = profile.fields[key];
  const record = (): FieldRecord => ({ ...cand, value: cand.value.trim(), updatedAt: Date.now(), corroboratedBy: [] });

  if (!existing) {
    profile.fields[key] = record();
    return { changed: true, conflict: false };
  }

  if (comparable(key, existing.value) === comparable(key, cand.value)) {
    const label = cand.sourceLabel;
    if (label !== existing.sourceLabel && !(existing.corroboratedBy || []).includes(label)) {
      existing.corroboratedBy = [...(existing.corroboratedBy || []), label];
    }
    if (rank[cand.status] > rank[existing.status]) {
      existing.status = cand.status;
      if (cand.checksumOk !== undefined) existing.checksumOk = cand.checksumOk;
    }
    existing.updatedAt = Date.now();
    return { changed: true, conflict: false };
  }

  if (cand.status === 'confirmed') {
    profile.fields[key] = record();
    profile.conflicts = profile.conflicts.filter((c) => c.key !== key);
    return { changed: true, conflict: false };
  }

  if (existing.status === 'self_declared' && cand.status === 'self_declared' && SELF.has(cand.source) && SELF.has(existing.source)) {
    profile.fields[key] = record();
    return { changed: true, conflict: false };
  }

  const open = profile.conflicts.find((c) => c.key === key);
  if (open) {
    if (!open.candidates.some((c) => comparable(key, c.value) === comparable(key, cand.value))) open.candidates.push(cand);
  } else {
    profile.conflicts.push({
      id: crypto.randomBytes(6).toString('hex'),
      key,
      candidates: [
        {
          value: existing.value,
          source: existing.source,
          sourceLabel: existing.sourceLabel,
          status: existing.status,
          docId: existing.docId,
          confidence: existing.confidence,
          checksumOk: existing.checksumOk,
        },
        cand,
      ],
    });
  }
  return { changed: false, conflict: true };
}

export function resolveConflict(profile: ProfileState, conflictId: string, choice: { index?: number; value?: string }): boolean {
  const conflict = profile.conflicts.find((c) => c.id === conflictId);
  if (!conflict) return false;
  const picked = typeof choice.index === 'number' ? conflict.candidates[choice.index] : undefined;
  const value = picked ? picked.value : (choice.value || '').trim();
  if (!value) return false;
  profile.fields[conflict.key] = {
    value,
    source: picked ? picked.source : 'typed',
    sourceLabel: picked ? `${picked.sourceLabel} (you confirmed)` : 'You typed',
    status: 'confirmed',
    docId: picked?.docId,
    checksumOk: picked?.checksumOk,
    corroboratedBy: [],
    updatedAt: Date.now(),
  };
  profile.conflicts = profile.conflicts.filter((c) => c.id !== conflictId);
  return true;
}

/** Remove values that came only from a deleted document and were never confirmed. */
export function forgetDocument(profile: ProfileState, docId: string) {
  for (const [k, f] of Object.entries(profile.fields)) {
    if (f && f.docId === docId && f.status !== 'confirmed') delete profile.fields[k as ProfileKey];
  }
  for (const c of profile.conflicts) c.candidates = c.candidates.filter((x) => x.docId !== docId);
  profile.conflicts = profile.conflicts.filter((c) => c.candidates.length > 1);
}

export const SOURCE_LABELS: Record<string, string> = {
  typed: 'You typed',
  voice: 'You said (voice)',
  chat: 'Chat assistant',
  helpline: 'Helpline',
  answer: 'Your answer',
};

/**
 * A choice saved before answers were understood can hold the words as heard ("I male"). Such a
 * value is read again by the same rules as an answer and kept as the option it clearly means;
 * a value whose meaning is not clear is left as it is.
 */
export function repairChoices(profile: ProfileState): boolean {
  let changed = false;
  for (const [key, field] of Object.entries(profile.fields)) {
    const def = PROFILE_FIELD_MAP[key as ProfileKey];
    if (!field || def?.type !== 'select' || !def.options || def.options.includes(field.value)) continue;
    const n = normalise('select', field.value, def.options);
    if (n.ok && n.value) {
      field.value = n.value;
      changed = true;
    }
  }
  // A conflict between "I male" and "Male" is no conflict once both are read the same way
  const meaning = (key: ProfileKey, v: string) => {
    const def = PROFILE_FIELD_MAP[key];
    if (def?.type !== 'select' || !def.options) return comparable(key, v);
    const n = normalise('select', v, def.options);
    return n.ok && n.value ? n.value : v;
  };
  const before = profile.conflicts.length;
  profile.conflicts = profile.conflicts.filter((c) => {
    const current = profile.fields[c.key]?.value;
    return !(current && PROFILE_FIELD_MAP[c.key]?.type === 'select' && c.candidates.every((x) => meaning(c.key, x.value) === meaning(c.key, current)));
  });
  return changed || profile.conflicts.length !== before;
}
