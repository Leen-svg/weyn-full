import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const username = (new URL(req.url).searchParams.get("username") || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return NextResponse.json({ available: false, error: "Use 3–24 letters, numbers, or underscores" }, { status: 400 });
  }

  const { data, error } = await db()
    .from("profile_public")
    .select("id")
    .ilike("display_name", username)
    .neq("id", user.id)
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ available: !data?.length });
}


