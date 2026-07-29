import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;
let triedAndFailed = false;

/** Returns the shared Supabase client, or null if it isn't configured (or
 *  misconfigured) yet (see README.md "Setting up shared storage"). Callers
 *  should fall back to local-only behavior when this returns null rather
 *  than throwing.
 *
 *  IMPORTANT: supabase-js throws synchronously if the URL isn't a valid
 *  absolute URL (e.g. missing "https://", a stray space, a trailing
 *  slash typo). Left unguarded, that exception happens during render and
 *  blanks out the entire app — not just the Supabase-dependent parts. So
 *  we catch it here once and quietly disable shared storage instead. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured() || triedAndFailed) return null;
  if (!client) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      triedAndFailed = true;
      console.error(
        "Supabase client failed to initialize — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for typos " +
          "(the URL must look exactly like https://your-project-ref.supabase.co, no trailing slash or extra spaces). " +
          "Falling back to local-only storage for this session.",
        e
      );
      return null;
    }
  }
  return client;
}

let signupClient: SupabaseClient | null = null;

/** A second, throwaway Supabase client used ONLY for an Admin creating a new
 *  teammate's account (auth.signUp). Deliberately separate from the main
 *  client: calling auth.signUp() on the *main* client would adopt the newly
 *  created account as the current session — silently signing the Admin out
 *  of their own account and into the brand-new one, in the same tab. This
 *  client has persistSession/autoRefreshToken off, so it never touches
 *  localStorage or the Admin's real session at all. */
export function getSupabaseForSignup(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!signupClient) {
    try {
      signupClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    } catch {
      return null;
    }
  }
  return signupClient;
}
