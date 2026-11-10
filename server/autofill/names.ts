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

/** Only the year is printed on some documents (Aadhaar often shows just "1991"). */
const YEAR_ONLY = /^\s*((?:19|20)\d{2})\s*$/;

/** same: one date; similar: one is only a year and it matches; different: otherwise. */
export function compareDates(a: string, b: string, normalise: (v: string) => string | null): 'same' | 'similar' | 'different' {
  const na = normalise(a);
  const nb = normalise(b);
  if (na && nb) return na === nb ? 'same' : 'different';
  const ya = a.match(YEAR_ONLY)?.[1];
  const yb = b.match(YEAR_ONLY)?.[1];
  if (ya && nb && nb.endsWith(`/${ya}`)) return 'similar';
  if (yb && na && na.endsWith(`/${yb}`)) return 'similar';
  if (ya && yb) return ya === yb ? 'same' : 'different';
  return 'different';
}

/** True when two dates are the same digits with day and month the other way round (03/04 and 04/03). */
export function daysSwapped(a: string, b: string, normalise: (v: string) => string | null): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na || !nb || na === nb) return false;
  const [da, ma, ya] = na.split('/');
  const [db, mb, yb] = nb.split('/');
  return da === mb && ma === db && ya === yb;
}

const ADDRESS_NOISE = new Set(['no', 'door', 'flat', 'house', 'plot', 'near', 'opp', 'opposite', 'post', 'po', 'via', 'the', 'of', 'dist', 'district', 'tq', 'taluk']);

function addressTokens(v: string): string[] {
  return v
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t && !ADDRESS_NOISE.has(t));
}

/**
 * Addresses are written many ways ("12, Gandhi St" and "12 Gandhi Street, Anna Nagar").
 * similar: every number matches and most of the words of the shorter one are in the longer one.
 */
export function compareAddresses(a: string, b: string): 'same' | 'similar' | 'different' {
  const x = addressTokens(a);
  const y = addressTokens(b);
  if (!x.length || !y.length) return 'different';
  if ([...x].sort().join(' ') === [...y].sort().join(' ')) return 'same';
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const canon = (t: string) => (/^(st|str|street)$/.test(t) ? 'street' : /^(rd|road)$/.test(t) ? 'road' : /^(nagar|ngr)$/.test(t) ? 'nagar' : t);
  const longSet = new Set(long.map(canon));
  const numbers = short.filter((t) => /\d/.test(t));
  if (!numbers.every((n) => longSet.has(n))) return 'different';
  const hit = short.filter((t) => longSet.has(canon(t))).length;
  return short.length >= 3 && hit / short.length >= 0.8 ? 'similar' : 'different';
}
