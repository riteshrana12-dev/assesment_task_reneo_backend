import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Service-role client: bypasses RLS entirely.
// Only created lazily — if SUPABASE_SERVICE_ROLE_KEY isn't set yet,
// the app still runs fine; this just throws if something actually tries to use it.
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env when you need service-role access (e.g. seeding).",
    );
  }
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return _supabaseAdmin;
}

// Per-request client: respects RLS. Built fresh per request using the
// caller's JWT, so Postgres policies see the real authenticated user.
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
