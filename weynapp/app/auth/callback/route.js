import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// OAuth (Google) redirects here with a ?code= to exchange for a session.
export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = type === "recovery" ? "/reset-password" : searchParams.get("next") || "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
