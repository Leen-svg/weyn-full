import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  const { tags, maxSpend, aestheticOnly, zones, maxAge, city } = await req.json();
  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
  }
  const { data, error } = await db().rpc("get_shortlist", {
    p_tag_slugs: tags,
    p_max_spend: maxSpend || 99999,
    p_aesthetic_only: !!aestheticOnly,
    p_zone_slugs: zones && zones.length ? zones : null,
    p_max_age: maxAge || "all-ages",
    p_limit: 3,
    p_city: city === "Dubai" ? "Dubai" : "Abu Dhabi",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ venues: data || [] });
}
