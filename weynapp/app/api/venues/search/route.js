import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/request-security";

export async function GET(req) {
  const limited = await rateLimit(req, "venue-search", 120, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many searches. Try again later." }, { status: 429 });
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 80).replace(/[%_]/g, "");
  if (q.length < 2) return NextResponse.json({ results: [] });

  const service = db();
  const [{ data: named, error }, { data: matchingTags }] = await Promise.all([
    service
      .from("venues")
      .select("id, name, neighborhood, city, avg_spend_aed, venue_tags(vibe_tags(display_name))")
      .eq("is_active", true)
      .ilike("name", `%${q}%`)
      .limit(8),
    service.from("vibe_tags").select("id").eq("is_active", true).ilike("display_name", `%${q}%`).limit(12),
  ]);
  if (error) return NextResponse.json({ error: "Search is temporarily unavailable" }, { status: 500 });
  const tagIds = (matchingTags || []).map((tag) => tag.id);
  const { data: links } = tagIds.length
    ? await service.from("venue_tags").select("venue_id").in("tag_id", tagIds).limit(24)
    : { data: [] };
  const venueIds = [...new Set((links || []).map((link) => link.venue_id))];
  const { data: tagged } = venueIds.length
    ? await service
        .from("venues")
        .select("id, name, neighborhood, city, avg_spend_aed, venue_tags(vibe_tags(display_name))")
        .eq("is_active", true)
        .in("id", venueIds)
        .limit(8)
    : { data: [] };
  const results = [...(named || []), ...(tagged || [])]
    .filter((venue, index, all) => all.findIndex((candidate) => candidate.id === venue.id) === index)
    .slice(0, 8)
    .map((venue) => ({ ...venue, tags: (venue.venue_tags || []).map((link) => link.vibe_tags?.display_name).filter(Boolean) }));
  return NextResponse.json({ results });
}
