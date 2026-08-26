import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to plan" }, { status: 401 });
  const [saved, personal, boards, profile, curators, follows] = await Promise.all([
    supabase.from("saves").select("venue_id, venues(id,name,neighborhood,city,latitude,longitude)").order("created_at", { ascending: false }).limit(100),
    supabase.from("personal_places").select("id,name,neighborhood,city,latitude,longitude,source_url,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("trip_boards").select("id,title,share_slug,is_public,visibility,archived_at,created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("profile_public").select("ghost_mode").eq("id", user.id).maybeSingle(),
    supabase.from("profile_public").select("id,display_name,avatar_url,bio").eq("is_curator", true).neq("id", user.id).limit(8),
    supabase.from("curator_follows").select("curator_id").eq("follower_id", user.id),
  ]);
  const followed = new Set((follows.data || []).map((row) => row.curator_id));
  return NextResponse.json({
    places: [...(saved.data || []).filter((row) => row.venues).map((row) => ({ ...row.venues, kind: "venue" })), ...(personal.data || []).map((row) => ({ ...row, kind: "personal" }))],
    boards: boards.data || [], ghostMode: profile.data?.ghost_mode !== false,
    curators: (curators.data || []).map((curator) => ({ ...curator, following: followed.has(curator.id) })),
  });
}

export async function PATCH(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const body = await req.json();
  if (body.action === "ghost") {
    const { error } = await supabase.from("profile_public").update({ ghost_mode: body.ghostMode !== false }).eq("id", user.id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if ((body.action === "follow" || body.action === "unfollow") && body.curatorId && body.curatorId !== user.id) {
    const { data: curator } = await supabase.from("profile_public").select("id").eq("id", body.curatorId).eq("is_curator", true).maybeSingle();
    if (!curator) return NextResponse.json({ error: "Curator not found" }, { status: 404 });
    const query = body.action === "follow"
      ? supabase.from("curator_follows").upsert({ follower_id: user.id, curator_id: body.curatorId })
      : supabase.from("curator_follows").delete().eq("follower_id", user.id).eq("curator_id", body.curatorId);
    const { error } = await query;
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
