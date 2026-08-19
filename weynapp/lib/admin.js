import { createClient } from "@/lib/supabase/server";

// Real admin check: a logged-in Supabase user whose own profiles row has
// is_admin = true. Uses the user's own session (RLS-scoped to their row),
// not the service-role key, this function can't be tricked into reading
// anyone else's admin flag.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return null;

  return user;
}
