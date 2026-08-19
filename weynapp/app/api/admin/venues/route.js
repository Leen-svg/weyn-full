import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { safeUrl } from "@/lib/sanitize";
import { NextResponse } from "next/server";

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const s = db();

  let query = s
    .from("venues")
    .select("id, name, neighborhood, zone_slug, city, avg_spend_aed, hero_video_url, description, is_trending, trending_rank, is_active")
    .order("name")
    .limit(50);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ venues: data || [] });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, neighborhood, city, avg_spend_aed } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await db()
    .from("venues")
    .insert({
      name: name.trim(),
      neighborhood: neighborhood?.trim() || null,
      city: city === "Dubai" ? "Dubai" : "Abu Dhabi",
      avg_spend_aed: Number.isFinite(avg_spend_aed) ? avg_spend_aed : 0,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, patch } = await req.json();
  if (!id || !patch) return NextResponse.json({ error: "id and patch required" }, { status: 400 });

  const allowed = [
    "name",
    "neighborhood",
    "city",
    "avg_spend_aed",
    "hero_video_url",
    "google_maps_url",
    "description",
    "is_trending",
    "trending_rank",
    "is_active",
    "latitude",
    "longitude",
  ];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  if ("hero_video_url" in clean) clean.hero_video_url = clean.hero_video_url ? safeUrl(clean.hero_video_url) : null;
  if ("google_maps_url" in clean) clean.google_maps_url = clean.google_maps_url ? safeUrl(clean.google_maps_url) : null;
  if (clean.is_trending) clean.trending_set_at = new Date().toISOString();

  const { error } = await db().from("venues").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
