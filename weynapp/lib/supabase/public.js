// The publishable Supabase URL and anon key.
//
// These two are PUBLIC by design: they ship inside the browser bundle of every
// Supabase app. Row-level security is what protects the data, not secrecy of
// this key. They are inlined here as fallbacks so the app still works if the
// NEXT_PUBLIC_* env vars have not been set in Vercel yet. Env vars win when set.
//
// The service_role key is NOT here and must never be. It lives only in
// SUPABASE_SERVICE_ROLE_KEY, server-side, and is read in lib/db.js.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://itnonbrlfoafqhknncit.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_lA14C58eXlCuL0Q4j0Y7Zw_wXWghRul";

