import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers } from "@/lib/venueMedia";
import { cleanStringList, payloadTooLarge, validCoordinates } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { mergeVenueResults, shortlistResultNote } from "@/lib/shortlist-utils.mjs";

const ALLOWED_AGES = new Set(["all-ages", "18-plus", "21-plus"]);

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "shortlist", 120, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many searches. Try again later." }, { status: 429 });
  const { tags, maxSpend, aestheticOnly, zones, maxAge, city, nearby } = await req.json();
  const safeTags = cleanStringList(tags);
  const safeZones = cleanStringList(zones);
  if (safeTags.length === 0) {
    return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
  }

  const safeAge = ALLOWED_AGES.has(maxAge) ? maxAge : "all-ages";
  const safeCity = city === "Dubai" ? "Dubai" : "Abu Dhabi";
  const safeSpend = Number.isFinite(Number(maxSpend)) ? Math.max(0, Math.min(100000, Number(maxSpend))) : 99999;
  const nearbyRequested = nearby && typeof nearby === "object";
  const lat = Number(nearby?.lat);
  const lng = Number(nearby?.lng);
  const radiusKm = Math.max(1, Math.min(50, Number(nearby?.radiusKm) || 15));

  if (nearbyRequested && !validCoordinates(lat, lng)) {
    return NextResponse.json({ error: "A valid location is required for Near me" }, { status: 400 });
  }

  const sharedParams = {
    p_tag_slugs: safeTags,
    p_max_spend: safeSpend,
    p_aesthetic_only: !!aestheticOnly,
    p_zone_slugs: safeZones.length ? safeZones : null,
    p_max_age: safeAge,
    p_city: safeCity,
  };

  const rpcName = nearbyRequested ? "get_shortlist_nearby" : "get_shortlist";
  const nearbyParams = nearbyRequested ? { p_lat: lat, p_lng: lng, p_radius_km: radiusKm } : {};
  const runShortlist = ({ random = false, excludeIds = [], limit = 3 } = {}) => db().rpc(rpcName, {
    ...sharedParams,
    ...nearbyParams,
    p_random: random,
    p_exclude_ids: excludeIds,
    p_limit: limit,
  });

  const { data, error } = await runShortlist();
  if (error) return NextResponse.json({ error: "Couldn't build a shortlist" }, { status: 500 });

  const exact = data || [];
  let fallback = [];
  if (exact.length < 3) {
    const fallbackResult = await runShortlist({
      random: true,
      excludeIds: exact.map((venue) => venue.id),
      limit: 3 - exact.length,
    });
    if (!fallbackResult.error) fallback = fallbackResult.data || [];
  }

  const venues = mergeVenueResults(exact, fallback, 3);
  const relaxedCount = Math.max(0, venues.length - exact.length);
  return NextResponse.json({
    venues: await withCovers(venues),
    relaxed: relaxedCount > 0,
    note: shortlistResultNote({ total: venues.length, relaxedCount, nearby: nearbyRequested }),
  });
}
