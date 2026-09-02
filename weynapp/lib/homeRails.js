import "server-only";
import { db } from "@/lib/db";

// The two dated/commercial rails that sit above the organic content on Home.
//
// Both are age-filtered by the caller's tier and both return an empty array
// rather than a placeholder when there is nothing real to show — an empty rail
// at the top of Home is the same trust tax as the community feed that was just
// removed, so the section unmounts entirely instead.

// `next_start` is a computed field (a Postgres function over the events row):
// for a one-off it is the original start, for a weekly series it is the next
// occurrence still to come, and it is null once the event or series is over.
// Selecting it here rather than querying the events_live view keeps the
// `venues(...)` embed working, which PostgREST cannot infer through a view.
const EVENT_FIELDS =
  "id, title, description, city, neighborhood, starts_at, ends_at, next_start, recurrence, recurrence_until, recurrence_days, age_restriction, event_type, cover_image_url, ticket_url, website_url, social_url, instagram_post_url, reservation_phone, is_trending, is_try_this_out, sort_order, partner, price_from_aed, venues(id, name, neighborhood, city, venue_tags(vibe_tags(display_name,display_order,is_active)))";

// The service-role client bypasses RLS, so expiry is re-applied here. Sorting
// happens in JS because the ordering key is computed per row.
function liveSorted(rows, limit) {
  return (rows || [])
    .filter((e) => e.next_start)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(a.next_start) - new Date(b.next_start))
    .slice(0, limit);
}

export async function getUpcomingEvents(allowedAges, { limit = 12, city = null } = {}) {
  let q = db()
    .from("events")
    .select(EVENT_FIELDS)
    .eq("is_active", true)
    .in("age_restriction", allowedAges)
    // A weekly series whose first date is long past is still live, so the
    // query cannot filter on starts_at — over-fetch and resolve in JS.
    .order("starts_at", { ascending: true })
    .limit(Math.max(limit * 4, 60));
  if (city) q = q.eq("city", city);

  const { data, error } = await q;
  if (error) return [];
  return liveSorted(data, limit);
}

export async function getAttractions(allowedAges, { limit = 12, city = null } = {}) {
  let q = db()
    .from("attractions")
    .select("id, title, description, city, neighborhood, category, cover_image_url, affiliate_url, partner, price_from_aed, age_restriction")
    .eq("is_active", true)
    .in("age_restriction", allowedAges)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (city) q = q.eq("city", city);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
}

export { EVENT_FIELDS, liveSorted };
