import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { awardPoints, POINTS } from "@/lib/points";
import { rateLimit } from "@/lib/request-security";
import { coordinates, haversineKm } from "@/lib/planner-utils.mjs";

// How close the device has to be for the visit to count. Generous enough for
// a large venue, GPS drift and a mall interior; tight enough that it cannot be
// claimed from another neighbourhood.
const MAX_DISTANCE_M = 250;

// A fix this coarse is an IP or wifi-triangulation guess, not GPS, and would
// make the radius check meaningless.
const MAX_ACCURACY_M = 200;

// Nothing legitimate moves between two check-ins faster than this.
const MAX_SPEED_KMH = 900;

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

  const { venueId, latitude, longitude, accuracy } = await req.json();
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const here = coordinates({ latitude, longitude });
  if (!here) {
    return NextResponse.json(
      { error: "Weyn needs your location to confirm you were here.", needsLocation: true },
      { status: 422 }
    );
  }

  const accuracyM = Number(accuracy);
  if (Number.isFinite(accuracyM) && accuracyM > MAX_ACCURACY_M) {
    return NextResponse.json(
      { error: "Your location is too approximate to confirm a visit. Try again outdoors or with precise location on.", needsLocation: true },
      { status: 422 }
    );
  }

  const { data: venue } = await db()
    .from("venues")
    .select("id, latitude, longitude")
    .eq("id", venueId)
    .eq("is_active", true)
    .maybeSingle();
  if (!venue) return NextResponse.json({ error: "That place is not available" }, { status: 404 });

  const there = coordinates(venue);
  if (!there) {
    return NextResponse.json({ error: "We don't have this place's exact location yet, so visits can't be confirmed here." }, { status: 422 });
  }

  const distanceM = Math.round(haversineKm({ latitude: here[0], longitude: here[1] }, venue) * 1000);
  if (distanceM > MAX_DISTANCE_M) {
    return NextResponse.json(
      { error: "You need to be at the place to confirm a visit.", tooFar: true, distanceM },
      { status: 422 }
    );
  }

  // Impossible travel: a device cannot be here now and somewhere far away a
  // moment ago. Catches one account claiming venues across both cities in a
  // single sitting, which the per-venue daily limit alone does not.
  const { data: previous } = await supabase
    .from("check_ins")
    .select("latitude, longitude, created_at")
    .eq("user_id", user.id)
    .not("latitude", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previous) {
    const hours = (Date.now() - new Date(previous.created_at).getTime()) / 3_600_000;
    const km = haversineKm({ latitude: here[0], longitude: here[1] }, previous);
    if (hours > 0 && Number.isFinite(km) && km / hours > MAX_SPEED_KMH) {
      return NextResponse.json(
        { error: "That's too far from your last check-in to be a real trip. Try again shortly." },
        { status: 422 }
      );
    }
  }

  const { data: row, error } = await supabase
    .from("check_ins")
    .insert({
      user_id: user.id,
      venue_id: venueId,
      latitude: here[0],
      longitude: here[1],
      accuracy_m: Number.isFinite(accuracyM) ? Math.round(accuracyM) : null,
      distance_m: distanceM,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: review } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle();
      return NextResponse.json({ ok: true, alreadyCheckedIn: true, pointsEarned: 0, hasRated: !!review, ratePoints: POINTS.rated_a_place });
    }
    // The proof-of-presence migration has not been applied yet. PostgREST
    // reports this from its schema cache (PGRST204) rather than as Postgres's
    // own undefined-column 42703, so match both.
    if (error.code === "42703" || error.code === "PGRST204" || /schema cache/i.test(error.message || "")) {
      console.error("check-in proof columns missing — apply 20260827140000_check_in_proof.sql", error);
      return NextResponse.json({ error: "Visit confirmation is still being set up. Try again later." }, { status: 503 });
    }
    // Never hand a raw Postgres message to the client — it leaks schema
    // detail and reads as a crash. Log it, show something actionable.
    console.error("check-in insert failed", error);
    return NextResponse.json({ error: "Couldn't confirm that visit right now. Try again shortly." }, { status: 500 });
  }

  // Only report points that were actually credited. The visit itself is
  // recorded either way — it is the reason the row exists — but claiming a
  // reward that did not land is worse than staying quiet about it.
  const awarded = await awardPoints(user.id, POINTS.checked_in, "checked_in");

  const { data: review } = await supabase.from("reviews").select("id").eq("user_id", user.id).eq("venue_id", venueId).maybeSingle();
  return NextResponse.json({
    ok: true,
    id: row.id,
    pointsEarned: awarded ? POINTS.checked_in : 0,
    hasRated: !!review,
    ratePoints: POINTS.rated_a_place,
  });
}
