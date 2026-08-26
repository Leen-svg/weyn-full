import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to find friends" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data, error } = await supabase
    .from("profile_public")
    .select("id, display_name, avatar_url")
    .ilike("display_name", `%${q}%`)
    .neq("id", user.id)
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data || [] });
}

