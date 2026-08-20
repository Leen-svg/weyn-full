import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to plan" }, { status: 401 });
  const [saved, personal, boards, profile, curators] = await Promise.all([
    supabase.from("saves").select("venue_id, venues(*)").order("created_at", { ascending: false }),
    supabase.from("personal_places").select("*").order("created_at", { ascending: false }),
    supabase.from("trip_boards").select("id,title,share_slug,is_public,created_at").order("created_at", { ascending: false }),
    supabase.from("profile_public").select("ghost_mode").eq("id", user.id).maybeSingle(),
    supabase.from("profile_public").select("id,display_name,avatar_url,bio,favorite_tags").eq("is_curator", true).limit(8),
  ]);
  return NextResponse.json({
    places: [...(saved.data || []).map((x) => ({ ...x.venues, kind: "venue" })), ...(personal.data || []).map((x) => ({ ...x, kind: "personal" }))],
    boards: boards.data || [], ghostMode: profile.data?.ghost_mode !== false, curators: curators.data || [],
  });
}

export async function PATCH(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const { ghostMode } = await req.json();
  const { error } = await supabase.from("profile_public").update({ ghost_mode: ghostMode !== false }).eq("id", user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
