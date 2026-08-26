import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeRelativePath } from "@/lib/request-security.mjs";

// OAuth (Google) redirects here with a ?code= to exchange for a session.
export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const requestedNext = searchParams.get("next") || "/app";
  const safeNext = safeRelativePath(requestedNext);
  const next = type === "recovery" ? "/reset-password" : safeNext;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (type !== "recovery") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profile_public")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle();
          if (!/^[a-z0-9_]{3,24}$/.test(profile?.display_name || "")) {
            return NextResponse.redirect(`${origin}/onboarding?next=${encodeURIComponent(next)}`);
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}


