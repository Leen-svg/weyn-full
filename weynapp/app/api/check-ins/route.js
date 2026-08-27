import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";
import { rateLimit } from "@/lib/request-security";

// Has this person already confirmed a visit here today, and have they rated it?
// The composer uses both to decide what to offer next.
export async function GET(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const venueId = new URL(req.url).searchParams.get("venueId");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const [{ data: checkIn }, { data: review }] = await Promise.all([
    supabase.from("check_ins").select("id, visited_on").eq("user_id", user.id).eq("venue_id", venueId)
      .order("visited_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("reviews").select("id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle(),
  ]);

  return NextResponse.json({
    checkedIn: !!checkIn,
    lastVisit: checkIn?.visited_on || null,
    hasRated: !!review,
    points: { checkIn: POINTS.checked_in, rate: POINTS.rated_a_place },
  });
}

export async function POST(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to confirm a visit" }, { status: 401 });

  if (!(await rateLimit(req, "check-in", 20, 86400, user.id)).allowed) {
    return NextResponse.json({ error: "You've confirmed a lot of visits today. Try again tomorrow." }, { status: 429 });
  }

  const { venueId } = await req.json();
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { data: venue } = await db().from("venues").select("id").eq("id", venueId).eq("is_active", true).maybeSingle();
  if (!venue) return NextResponse.json({ error: "That place is not available" }, { status: 404 });

  const { data: row, error } = await supabase
    .from("check_ins")
    .insert({ user_id: user.id, venue_id: venueId })
    .select("id")
    .single();

  // 23505 is the one-per-day unique constraint: they already confirmed today,
  // which is not an error, it just earns nothing further.
  if (error) {
    if (error.code === "23505") {
      const { data: review } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle();
      return NextResponse.json({ ok: true, alreadyCheckedIn: true, pointsEarned: 0, hasRated: !!review, ratePoints: POINTS.rated_a_place });
    }
    // Never hand a raw Postgres message to the client — it leaks schema
    // detail and reads as a crash. Log it, show something actionable.
    console.error("check-in insert failed", error);
    return NextResponse.json({ error: "Couldn't confirm that visit right now. Try again shortly." }, { status: 500 });
  }

  await awardPoints(user.id, POINTS.checked_in, "checked_in");

  const { data: review } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle();
  return NextResponse.json({
    ok: true,
    id: row.id,
    pointsEarned: POINTS.checked_in,
    hasRated: !!review,
    ratePoints: POINTS.rated_a_place,
  });
}
