import { db } from "./db";

// Attach every piece of metadata shared by VenueCard. Keeping this in one
// hydrator prevents individual screens from accidentally omitting media or
// tags when they use a narrower venue query.
export async function withCovers(venues) {
  if (!venues?.length) return venues || [];
  const ids = venues.map((v) => v.id);
  const [{ data: media }, { data: tagLinks }] = await Promise.all([
    db()
      .from("venue_media")
      .select("venue_id, url, media_type, display_order, created_at")
      .in("venue_id", ids)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true }),
    db()
      .from("venue_tags")
      .select("venue_id, vibe_tags(display_name, display_order, is_active)")
      .in("venue_id", ids),
  ]);
  const coverMap = {};
  const mediaMap = {};
  for (const item of media || []) {
    if (!mediaMap[item.venue_id]) mediaMap[item.venue_id] = [];
    mediaMap[item.venue_id].push({ url: item.url, type: item.media_type });
    if (item.media_type === "image" && !coverMap[item.venue_id]) coverMap[item.venue_id] = item.url;
  }
  const tagMap = {};
  for (const link of tagLinks || []) {
    const tag = link.vibe_tags;
    if (!tag?.is_active || !tag.display_name) continue;
    if (!tagMap[link.venue_id]) tagMap[link.venue_id] = [];
    tagMap[link.venue_id].push(tag);
  }
  for (const tags of Object.values(tagMap)) tags.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  return venues.map((v) => ({
    ...v,
    cover_url: coverMap[v.id] || null,
    media: mediaMap[v.id] || [],
    tags: (tagMap[v.id] || []).map((tag) => tag.display_name),
  }));
}


