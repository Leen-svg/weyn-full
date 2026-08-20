import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { payloadTooLarge, validCoordinates } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const limited = await rateLimit(req, "route-optimize", 60, 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "Too many route requests. Try again later." }, { status: 429 });
  const { places } = await req.json();
  if (!Array.isArray(places) || places.length < 3 || places.length > 4) return NextResponse.json({ error: "Choose 3–4 places" }, { status: 400 });
  const clean = places.map((place) => ({ key: `${place.kind}:${place.id}`, latitude: Number(place.latitude), longitude: Number(place.longitude) }));
  if (clean.some((place) => !validCoordinates(place.latitude, place.longitude))) return NextResponse.json({ error: "Missing or invalid coordinates" }, { status: 422 });
  const token = process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ error: "Route optimization unavailable" }, { status: 503 });
  const coordinates = clean.map((place) => `${place.longitude},${place.latitude}`).join(";");
  const response = await fetch(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?roundtrip=false&source=first&destination=last&overview=false&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) return NextResponse.json({ error: "Route optimization unavailable" }, { status: 502 });
  const body = await response.json();
  const order = (body.waypoints || []).map((waypoint, inputIndex) => ({ waypoint, inputIndex })).sort((a, b) => a.waypoint.waypoint_index - b.waypoint.waypoint_index).map(({ inputIndex }) => clean[inputIndex]?.key).filter(Boolean);
  return order.length === clean.length ? NextResponse.json({ order }) : NextResponse.json({ error: "Incomplete route" }, { status: 502 });
}

