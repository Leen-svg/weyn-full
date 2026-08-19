import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./public";

// Session-aware client: respects RLS as whichever user is logged in (or anon).
// Use this for anything scoped to "the current user", never for privileged
// admin writes, which go through lib/db.js's service-role client instead.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component render, middleware refreshes the session instead.
        }
      },
    },
  });
}
