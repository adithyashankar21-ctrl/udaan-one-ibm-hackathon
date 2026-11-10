/**
 * Comparing people's names across documents. Offices reject a form when the name differs from
 * the papers, but "Meenakshi R" and "R. Meenakshi" are one person, and a one-letter
 * transliteration difference ("Meenakshy") is a typo, not a different name.
 */

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'smt', 'shri', 'sri', 'shree', 'kumari', 'km', 'dr', 'late', 'sh', 'selvi', 'thiru', 'tmt']);
const RELATION = /\b(s\s*\/?\s*o|d\s*\/?\s*o|w\s*\/?\s*o|c\s*\/?\s*o)\b/g;

/** Words of a name: lower-case, no honorifics or "S/O", marks of Indian scripts kept intact. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFC')
    .replace(RELATION, ' ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t && !HONORIFICS.has(t));
}

/** True when two words differ by at most one inserted, deleted or changed letter. */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.slice(i) === l.slice(i + 1);
}

/** Two words are the same name part: equal, an initial of the other, or a one-letter typo. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length === 1 || b.length === 1) return a.startsWith(b) || b.startsWith(a);
  return Math.min(a.length, b.length) >= 5 && withinOne(a, b);
}

/**
 * same: identical words in any order.
 * similar: initials, a missing middle name or a one-letter spelling difference — one person,
 *   but worth telling the applicant, because an office may still ask about it.
 * different: otherwise.
 */
export function compareNames(a: string, b: string): 'same' | 'similar' | 'different' {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return 'different';
  if ([...x].sort().join(' ') === [...y].sort().join(' ')) return 'same';
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const pool = [...long];
  let whole = 0;
  for (const t of short) {
    const i = pool.findIndex((p) => sameWord(p, t));
    if (i < 0) return 'different';
    if (t.length > 1 && pool[i].length > 1) whole++;
    pool.splice(i, 1);
  }
  // Initials alone ("R" and "Ravi") say nothing: at least one whole word must really match
  return whole > 0 ? 'similar' : 'different';
}
