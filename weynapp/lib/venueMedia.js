import { db } from "./db";

// Attach each venue's first photo as `cover_url` for card display.
export async function withCovers(venues) {
  if (!venues?.length) return venues || [];
  const ids = venues.map((v) => v.id);
  const { data: media } = await db()
    .from("venue_media")
    .select("venue_id, url, media_type")
    .in("venue_id", ids)
    .eq("media_type", "image")
    .order("created_at", { ascending: true });
  const coverMap = {};
  for (const m of media || []) if (!coverMap[m.venue_id]) coverMap[m.venue_id] = m.url;
  return venues.map((v) => ({ ...v, cover_url: coverMap[v.id] || null }));
}
