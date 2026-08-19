import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  const { lat, lng, radiusKm } = await req.json();
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Location required" }, { status: 400 });
  }
  const { data, error } = await db().rpc("get_nearby", {
    p_lat: lat,
    p_lng: lng,
    p_radius_km: radiusKm || 15,
    p_limit: 6,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ venues: data || [] });
}
