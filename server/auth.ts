/**
 * Sign-in with Supabase. Switched on when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
 * (the same values the browser uses); without them the app works with anonymous sessions as before.
 * A request is signed in when it carries the Supabase access token; the token is checked with
 * Supabase and the result kept for a few minutes.
 */
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export const authEnabled = Boolean(SUPABASE_URL && ANON_KEY);

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
}

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { user: AuthUser | null; until: number }>();

/** The signed-in user for an access token, or null if it is missing, expired or not genuine. */
export async function verifyUser(accessToken: string | undefined | null): Promise<AuthUser | null> {
  if (!authEnabled || !accessToken) return null;
  const hit = cache.get(accessToken);
  if (hit && hit.until > Date.now()) return hit.user;
  let user: AuthUser | null = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const u = await res.json();
      if (u?.id) user = { id: String(u.id), email: u.email || undefined, phone: u.phone || undefined };
    }
  } catch {
    // Supabase unreachable: treat as signed out rather than letting anyone in
  }
  cache.set(accessToken, { user, until: Date.now() + (user ? CACHE_MS : 15000) });
  if (cache.size > 5000) cache.clear();
  return user;
}

export const bearerToken = (header: string | undefined) => (header?.startsWith('Bearer ') ? header.slice(7).trim() : null);
