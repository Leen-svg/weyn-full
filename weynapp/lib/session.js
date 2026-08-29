import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { maxAgeTier, allowedAgeRestrictions, canSee21Plus, isAdult21 } from "@/lib/age";

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

// What this viewer is allowed to see. Every surface that lists venues should
// read its age filter from here rather than deriving one locally, so there is
// exactly one place where the gate can be got wrong.
//
// A logged-out visitor, or any lookup that fails, resolves to "all-ages" —
// the safe default. `profiles` has no user-facing write policy, so this reads
// through the service role.
export const viewerAccess = cache(async () => {
  const { user } = await currentSession();
  if (!user) {
    return {
      user: null,
      tier: "all-ages",
      allowedAges: allowedAgeRestrictions("all-ages"),
      show21Plus: false,
      eligibleFor21Plus: false,
      hasAnsweredAge: false,
    };
  }

  const { data: profile } = await db()
    .from("profiles")
    .select("birthdate, show_21_plus, age_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();

  const tier = maxAgeTier(profile);
  return {
    user,
    tier,
    allowedAges: allowedAgeRestrictions(tier),
    show21Plus: canSee21Plus(profile),
    eligibleFor21Plus: isAdult21(profile),
    hasAnsweredAge: !!profile?.age_confirmed_at,
  };
});
