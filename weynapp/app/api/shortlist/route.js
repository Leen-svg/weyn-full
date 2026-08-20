import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers } from "@/lib/venueMedia";
import { cleanStringList, payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "shortlist", 120, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many searches. Try again later." }, { status: 429 });
  const { tags, maxSpend, aestheticOnly, zones, maxAge, city } = await req.json();
  const safeTags = cleanStringList(tags);
  const safeZones = cleanStringList(zones);
  if (safeTags.length === 0) {
    return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
  }
  const { data, error } = await db().rpc("get_shortlist", {
    p_tag_slugs: safeTags,
    p_max_spend: Number.isFinite(Number(maxSpend)) ? Math.max(0, Math.min(100000, Number(maxSpend))) : 99999,
    p_aesthetic_only: !!aestheticOnly,
    p_zone_slugs: safeZones.length ? safeZones : null,
    p_max_age: maxAge || "all-ages",
    p_limit: 3,
    p_city: city === "Dubai" ? "Dubai" : "Abu Dhabi",
  });
  if (error) return NextResponse.json({ error: "Couldn't build a shortlist" }, { status: 500 });
  return NextResponse.json({ venues: await withCovers(data || []) });
}

