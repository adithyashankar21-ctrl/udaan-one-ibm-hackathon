/**
 * Format validation and normalisation for form values.
 * These checks only test the shape of a value — they cannot confirm it is genuine.
 */
import type { FieldType } from '../../src/data/autofillSchema';

/* Verhoeff checksum used by Aadhaar numbers */
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(num: string): boolean {
  if (!/^\d+$/.test(num)) return false;
  let c = 0;
  const digits = num.split('').reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}

/** A full 12-digit Aadhaar: correct length, cannot start with 0 or 1, passes Verhoeff. */
export function isValidAadhaar(digits: string): boolean {
  return /^[2-9]\d{11}$/.test(digits) && verhoeffValid(digits);
}

/** Replace any 12-digit Aadhaar-like sequence in free text with a masked form. */
export function scrubAadhaar(text: string): string {
  return text.replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, (_m, _a, _b, c) => `XXXX XXXX ${c}`);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse many date spellings into DD/MM/YYYY, or null. */
export function normaliseDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  let d: number, m: number, y: number;
  let match = s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})$/);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*,?\s+(\d{4})$/))) {
    [d, m, y] = [Number(match[1]), MONTHS[match[2]], Number(match[3])];
  } else if ((match = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/))) {
    [m, d, y] = [MONTHS[match[1]], Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (!m) return null;
  if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function ageFromDob(dob: string): number | null {
  const m = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const birth = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
}

/** Turn "2.5 lakh", "75,000", "₹ 1,20,000", "ढाई लाख" style amounts into a plain number string. */
export function normaliseMoney(raw: string): string | null {
  const s = raw.toLowerCase().replace(/,/g, '').replace(/₹|rs\.?|inr|rupees?|रुपये|रुपए/g, '').trim();
  const num = s.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  let n = Number(num[1]);
  if (/lakh|lac|लाख|ലക്ഷ|லட்ச|లక్ష|ಲಕ್ಷ/.test(s)) n *= 100000;
  else if (/crore|करोड़|cr\b/.test(s)) n *= 10000000;
  else if (/thousand|hazar|हज़ार|हजार|\bk\b/.test(s)) n *= 1000;
  if (!isFinite(n) || n < 0) return null;
  return String(Math.round(n));
}

export const isNone = (raw: string) => /^(none|no|nil|na|n\/a|not applicable|nahi|nahin|नहीं|नही|இல்லை|లేదు|ಇಲ್ಲ|ഇല്ല)\.?$/i.test(raw.trim());

export interface Normalised {
  ok: boolean;
  value?: string;
  /** Aadhaar: last four digits only. */
  last4?: string;
  checksumOk?: boolean;
  error?: string;
}

/**
 * Deterministic normalisation. Returns ok:false when the text does not clearly contain a
 * valid value — the caller may then ask Gemini to interpret free speech.
 */
export function normalise(type: FieldType, raw: string, options?: string[]): Normalised {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, error: 'Empty answer' };
  const compact = text.replace(/[\s-]/g, '');

  switch (type) {
    case 'mobile': {
      const m = compact.replace(/^(\+?91|0)(?=[6-9]\d{9}$)/, '').match(/[6-9]\d{9}/);
      return m && m[0].length === 10 ? { ok: true, value: m[0] } : { ok: false, error: 'Mobile numbers have 10 digits and start with 6, 7, 8 or 9' };
    }
    case 'pincode': {
      const m = text.match(/\b[1-9]\d{2}\s?\d{3}\b/);
      return m ? { ok: true, value: m[0].replace(/\s/g, '') } : { ok: false, error: 'PIN codes have 6 digits' };
    }
    case 'ifsc': {
      const m = compact.toUpperCase().match(/[A-Z]{4}0[A-Z0-9]{6}/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'IFSC codes have 11 characters: 4 letters, a zero, then 6 letters or digits' };
    }
    case 'pan': {
      const m = compact.toUpperCase().match(/[A-Z]{5}\d{4}[A-Z]/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'PAN has 10 characters, like ABCDE1234F' };
    }
    case 'email': {
      if (isNone(text)) return { ok: true, value: 'None' };
      const m = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
      return m ? { ok: true, value: m[0].toLowerCase() } : { ok: false, error: 'That does not look like an email address' };
    }
    case 'account': {
      const m = compact.match(/\d{9,18}/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'Bank account numbers have 9 to 18 digits' };
    }
    case 'aadhaar': {
      const digits = compact.replace(/\D/g, '');
      if (digits.length === 12) {
        const ok = isValidAadhaar(digits);
        return ok
          ? { ok: true, last4: digits.slice(-4), checksumOk: true, value: `XXXX XXXX ${digits.slice(-4)}` }
          : { ok: false, error: 'That Aadhaar number does not pass the checksum — please check the digits' };
      }
      if (digits.length === 4) return { ok: true, last4: digits, value: `XXXX XXXX ${digits}` };
      return { ok: false, error: 'Type the last 4 digits of your Aadhaar (or upload the card)' };
    }
    case 'date': {
      const v = normaliseDate(text);
      return v ? { ok: true, value: v } : { ok: false, error: 'Use DD/MM/YYYY, for example 14/08/1993' };
    }
    case 'money': {
      if (isNone(text)) return { ok: true, value: '0' };
      const v = normaliseMoney(text);
      return v ? { ok: true, value: v } : { ok: false, error: 'Please give an amount in rupees' };
    }
    case 'number': {
      const m = text.match(/\d+/);
      return m ? { ok: true, value: m[0] } : { ok: false, error: 'Please give a number' };
    }
    case 'select': {
      const opts = options || [];
      const lower = text.toLowerCase();
      const yes = /^(yes|haan|han|हाँ|हां|ஆம்|అవును|ಹೌದು|അതെ)/i.test(text);
      const no = isNone(text);
      const hit =
        opts.find((o) => o.toLowerCase() === lower) ||
        opts.find((o) => lower.includes(o.toLowerCase().split(/[\s(/]/)[0])) ||
        (yes ? opts.find((o) => /^yes$/i.test(o)) : undefined) ||
        (no ? opts.find((o) => /^no$/i.test(o)) : undefined);
      return hit ? { ok: true, value: hit } : { ok: false, error: `Choose one of: ${opts.join(', ')}` };
    }
    case 'text':
    default:
      if (isNone(text)) return { ok: true, value: 'None' };
      return { ok: true, value: text.replace(/\s+/g, ' ') };
  }
}

/** Validation of a stored value (used when building the form). Returns a problem or null. */
export function checkValue(type: FieldType, value: string, options?: string[], isBirthDate = false): string | null {
  if (!value) return null;
  if (type === 'aadhaar') return /^XXXX XXXX \d{4}$/.test(value) ? null : 'Aadhaar must be stored masked';
  if (type === 'text') return null;
  const n = normalise(type, value, options);
  if (!n.ok) return n.error || 'Invalid value';
  if (type === 'date' && isBirthDate) {
    const age = ageFromDob(n.value!);
    if (age !== null && (age < 10 || age > 100)) return `This date gives an age of ${age} — please check it`;
  }
  return null;
}

export const hasNonLatin = (s: string) => /[^\u0000-ɏ₹–—‘’“”]/.test(s);
