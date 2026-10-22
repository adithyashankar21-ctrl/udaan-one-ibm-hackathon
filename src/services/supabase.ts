import { createClient, type Session } from '@supabase/supabase-js';

/**
 * Supabase sign-in. Switched on by VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (built
 * into the app); without them the app runs without sign-in, as before.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
export const authEnabled = Boolean(supabase);

/** The Authorization header for our API, when signed in. */
export async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function signOut() {
  await supabase?.auth.signOut();
  window.location.reload();
}

export type { Session };
