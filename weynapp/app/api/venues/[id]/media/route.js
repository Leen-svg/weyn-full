import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  const service = db();
  const [{ data: venue }, { data: rows }, { data: tagLinks }] = await Promise.all([
    service.from("venues").select("id,hero_video_url").eq("id", id).eq("is_active", true).maybeSingle(),
    service.from("venue_media").select("url,media_type,display_order,created_at").eq("venue_id", id).order("display_order").order("created_at").limit(60),
    service.from("venue_tags").select("vibe_tags(display_name,display_order,is_active)").eq("venue_id", id),
  ]);
  if (!venue) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  const media = (rows || []).map((item) => ({ type: item.media_type, url: normalizeHttpUrl(item.url) })).filter((item) => item.url);
  const video = normalizeHttpUrl(venue.hero_video_url);
  if (video && !media.some((item) => item.url === video)) media.push({ type: "video", url: video });
  const tags = (tagLinks || []).map((link) => link.vibe_tags).filter((tag) => tag?.is_active && tag.display_name).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map((tag) => tag.display_name);
  return NextResponse.json({ media, tags, count: media.length }, { headers: { "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400" } });
}
