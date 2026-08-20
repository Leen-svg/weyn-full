import { createClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { db } from "@/lib/db";
import { contentAccountError, utcDayStart, validateCommunityText } from "@/lib/content-safety";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venue_id");
  if (!venueId) return NextResponse.json({ error: "venue_id required" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, photo_url, created_at, user_id")
    .eq("venue_id", venueId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reviews = data || [];
  const authorIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profile_public").select("id, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));

  return NextResponse.json({ reviews: reviews.map((r) => ({ ...r, profile_public: authorMap[r.user_id] || null })) });
}

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to leave a review" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });

  const { venueId, rating, body, photoUrl } = await req.json();
  const r = Number(rating);
  if (!venueId || !Number.isInteger(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: "A venue and a 1-5 rating are required" }, { status: 400 });
  }
  const checked = validateCommunityText(body, { maxLength: 1000 });
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (photoUrl) return NextResponse.json({ error: "Photo uploads are paused while we add stronger safety checks." }, { status: 400 });

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!existing) {
    const { count } = await db().from("reviews").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", utcDayStart());
    if ((count || 0) >= 10) return NextResponse.json({ error: "You've reached today's rating limit." }, { status: 429 });
  }

  const { error } = await supabase.from("reviews").upsert(
    { user_id: user.id, venue_id: venueId, rating: r, body: checked.text, photo_url: null, status: "published" },
    { onConflict: "user_id,venue_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let pointsEarned = 0;
  if (!existing) {
    pointsEarned = POINTS.rated_a_place;
    await awardPoints(user.id, POINTS.rated_a_place, "rated_a_place");
  }
  return NextResponse.json({ ok: true, pointsEarned });
}

