import { createClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { contentAccountError, utcDayStart, validateCommunityText } from "@/lib/content-safety";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") === "friends" ? "friends" : "public";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (scope === "friends" && !user) return NextResponse.json({ error: "Log in to see friend posts" }, { status: 401 });

  // RLS already enforces visibility (public posts to everyone, friends-only
  // posts only to accepted friends), these two queries just pick which
  // slice of what's visible to show for this toggle.
  let query = supabase
    .from("posts")
    .select("id, body, photo_url, visibility, created_at, user_id, venue_id, venues (id, name, neighborhood)")
    .order("created_at", { ascending: false })
    .limit(30);

  query = scope === "public" ? query.eq("visibility", "public") : query.eq("visibility", "friends").neq("user_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = data || [];
  const authorIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profile_public").select("id, display_name, avatar_url, ghost_mode").in("id", authorIds).eq("ghost_mode", false)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));

  return NextResponse.json({ posts: posts.filter((post) => authorMap[post.user_id]).map((post) => ({ ...post, profile_public: authorMap[post.user_id] })) });
}

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to post" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });

  const { venueId, body, visibility, photoUrl } = await req.json();
  const checked = validateCommunityText(body, { required: true, maxLength: 500 });
  if (!venueId || checked.error) return NextResponse.json({ error: checked.error || "Choose a venue" }, { status: 400 });
  if (photoUrl) return NextResponse.json({ error: "Photo uploads are paused while we add stronger safety checks." }, { status: 400 });
  const vis = visibility === "friends" ? "friends" : "public";
  const { count } = await db().from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", utcDayStart());
  if ((count || 0) >= 5) return NextResponse.json({ error: "You've reached today's posting limit." }, { status: 429 });

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    venue_id: venueId,
    body: checked.text,
    photo_url: null,
    visibility: vis,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await awardPoints(user.id, POINTS.posted, "posted");
  return NextResponse.json({ ok: true, pointsEarned: POINTS.posted });
}
