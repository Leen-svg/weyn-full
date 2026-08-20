import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UsernameOnboarding from "@/components/UsernameOnboarding";

export const metadata = { title: "Choose your username, Weyn" };

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

  if (/^[a-z0-9_]{3,24}$/.test(profile?.display_name || "")) redirect(next);

  return <UsernameOnboarding next={next} />;
}

