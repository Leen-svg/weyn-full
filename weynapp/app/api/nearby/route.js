import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { payloadTooLarge, validCoordinates } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { withCovers } from "@/lib/venueMedia";
import { viewerAccess } from "@/lib/session";
import { AGE_TIERS } from "@/lib/age";

const ALLOWED_AGES = new Set(AGE_TIERS);

// A request may narrow the tier but never widen it past the viewer's own.
function clampAge(requested, viewerTier) {
  const asked = ALLOWED_AGES.has(requested) ? requested : "all-ages";
  return AGE_TIERS.indexOf(asked) <= AGE_TIERS.indexOf(viewerTier) ? asked : viewerTier;
}

export async function POST(req) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "nearby", 120, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many location searches. Try again later." }, { status: 429 });
  const { lat, lng, radiusKm, maxAge } = await req.json();
  if (!validCoordinates(lat, lng)) {
    return NextResponse.json({ error: "Location required" }, { status: 400 });
  }
  const { tier } = await viewerAccess();
  const { data, error } = await db().rpc("get_nearby", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: Math.max(1, Math.min(50, Number(radiusKm) || 15)),
    p_limit: 6,
    p_max_age: clampAge(maxAge, tier),
  });
  if (error) return NextResponse.json({ error: "Nearby search is temporarily unavailable" }, { status: 500 });
  return NextResponse.json({ venues: await withCovers(data || []) });
}
