import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers } from "@/lib/venueMedia";

const DEFAULT_RADIUS_KM = 15;
const MAX_RADIUS_KM = 50;

export async function POST(req) {
  const { tags, maxSpend, aestheticOnly, zones, maxAge, city, nearby } = await req.json();
  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
  }

  const locationRequested = nearby !== null && nearby !== undefined;
  const hasValidLocation =
    locationRequested &&
    Number.isFinite(nearby?.lat) &&
    Number.isFinite(nearby?.lng) &&
    nearby.lat >= -90 &&
    nearby.lat <= 90 &&
    nearby.lng >= -180 &&
    nearby.lng <= 180;

  if (locationRequested && !hasValidLocation) {
    return NextResponse.json({ error: "Your location could not be read. Please try Near me again." }, { status: 400 });
  }

  const radiusKm = hasValidLocation
    ? Math.min(Math.max(Number(nearby.radiusKm) || DEFAULT_RADIUS_KM, 1), MAX_RADIUS_KM)
    : DEFAULT_RADIUS_KM;
  const s = db();
  const shortlistPromise = s.rpc("get_shortlist", {
    p_tag_slugs: tags,
    p_max_spend: maxSpend || 99999,
    p_aesthetic_only: !!aestheticOnly,
    p_zone_slugs: zones && zones.length ? zones : null,
    p_max_age: maxAge || "all-ages",
    p_limit: hasValidLocation ? 80 : 3,
    p_city: city === "Dubai" ? "Dubai" : "Abu Dhabi",
  });
  const nearbyPromise = hasValidLocation
    ? s.rpc("get_nearby", {
        p_lat: nearby.lat,
        p_lng: nearby.lng,
        p_radius_km: radiusKm,
        p_limit: 100,
        p_max_age: maxAge || "all-ages",
      })
    : Promise.resolve({ data: null, error: null });

  const [shortlistResult, nearbyResult] = await Promise.all([shortlistPromise, nearbyPromise]);
  if (shortlistResult.error) {
    return NextResponse.json({ error: shortlistResult.error.message }, { status: 500 });
  }
  if (nearbyResult.error) {
    return NextResponse.json({ error: "Near me is temporarily unavailable. Please retry or turn it off." }, { status: 500 });
  }

  let venues = shortlistResult.data || [];
  if (hasValidLocation) {
    const distanceById = new Map((nearbyResult.data || []).map((venue) => [venue.id, venue.distance_km]));
    venues = venues
      .filter((venue) => distanceById.has(venue.id))
      .slice(0, 3)
      .map((venue) => ({ ...venue, distance_km: distanceById.get(venue.id) }));
  }

  return NextResponse.json({ venues: await withCovers(venues) });
}


