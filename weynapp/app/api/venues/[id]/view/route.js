import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";

// One-time (per user per venue) points for actually reading a venue's
// reviews, deduped via venue_engagements so refreshing the page can't
// farm points. Silently no-ops for guests. Insert goes through the
// service-role client since venue_engagements intentionally has no
// insert policy for regular users (same pattern as points_ledger)
// points can only ever be granted by trusted server code, never self-awarded.
export async function POST(req, { params }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, pointsEarned: 0 });

  const { id: venueId } = await params;
  if (!venueId) return NextResponse.json({ error: "venue id required" }, { status: 400 });

  const { error } = await db().from("venue_engagements").insert({ user_id: user.id, venue_id: venueId });
  if (error) {
    // 23505 = already engaged with this venue before, not an error, just no repeat points
    if (error.code === "23505") return NextResponse.json({ ok: true, pointsEarned: 0 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await awardPoints(user.id, POINTS.viewed_ratings, "viewed_ratings");
  return NextResponse.json({ ok: true, pointsEarned: POINTS.viewed_ratings });
}
