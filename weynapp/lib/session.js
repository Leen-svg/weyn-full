import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Root layout and a page often need the same authenticated user. React's
// request-scoped cache prevents a second Supabase auth round-trip without
// persisting one user's session into another request.
export const currentSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});
