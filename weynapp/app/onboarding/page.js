import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import UsernameOnboarding from "@/components/UsernameOnboarding";
import AgeOnboarding from "@/components/AgeOnboarding";

export const metadata = { title: "Finish setting up, Weyn" };

export default async function OnboardingPage({ searchParams }) {
  const params = await searchParams;
  const requestedNext = params?.next || "/app";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/app";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);

  const { data: profile } = await supabase
    .from("profile_public")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Username first: everything social-facing keys off it.
  if (!/^[a-z0-9_]{3,24}$/.test(profile?.display_name || "")) {
    return <UsernameOnboarding next={next} />;
  }

  // Then the age gate. `profiles` is select-own under RLS but has no user
  // write policy, so this reads through the service role like the API route.
  const { data: account } = await db()
    .from("profiles")
    .select("age_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!account?.age_confirmed_at) return <AgeOnboarding next={next} />;

  redirect(next);
}
