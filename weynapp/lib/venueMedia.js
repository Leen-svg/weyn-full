import { db } from "./db";

// Attach ordered venue media for card carousels, with the first photo kept as
// `cover_url` for backwards compatibility.
export async function withCovers(venues) {
  if (!venues?.length) return venues || [];
  const ids = venues.map((v) => v.id);
  const { data: media } = await db()
    .from("venue_media")
    .select("venue_id, url, media_type, display_order, created_at")
    .in("venue_id", ids)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  const coverMap = {};
  const mediaMap = {};
  for (const item of media || []) {
    if (!mediaMap[item.venue_id]) mediaMap[item.venue_id] = [];
    mediaMap[item.venue_id].push({ url: item.url, type: item.media_type });
    if (item.media_type === "image" && !coverMap[item.venue_id]) coverMap[item.venue_id] = item.url;
  }
  return venues.map((v) => ({ ...v, cover_url: coverMap[v.id] || null, media: mediaMap[v.id] || [] }));
}

