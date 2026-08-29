import "server-only";
import { db } from "@/lib/db";
import { withCovers } from "@/lib/venueMedia";

// The 21+ surface: clubs, bars & lounges, beach clubs, and dated nights.
//
// Callers must pass the viewer's allowed age tiers from `viewerAccess()`.
// Nothing here decides eligibility for itself — that judgement lives in one
// place (lib/age.js) so it cannot drift between surfaces.

const VENUE_FIELDS =
  "id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, menu_url, is_aesthetic, age_restriction, category, description";

// "club" has no rows yet — the catalogue has never had the category. It is
// listed first anyway so the rail exists the moment venues are tagged.
export const NIGHTLIFE_RAILS = [
  { key: "clubs", title: "Clubs", blurb: "Late, loud, and worth the queue.", categories: ["club", "nightclub"] },
  { key: "bars", title: "Bars & lounges", blurb: "Somewhere to actually hear each other.", categories: ["bar", "lounge"] },
  { key: "beach", title: "Beach clubs", blurb: "Day into night.", categories: ["beach-club"] },
  { key: "shisha", title: "Shisha", blurb: "Long nights, slow smoke.", categories: ["shisha"] },
];

export async function getNightlife(allowedAges, { city = null, limitPerRail = 12 } = {}) {
  // A viewer who cannot see 21+ content gets nothing rather than a thinner
  // version of the section.
  if (!allowedAges?.includes("21-plus")) {
    return { rails: [], events: [], isEmpty: true };
  }

  const s = db();
  const categories = NIGHTLIFE_RAILS.flatMap((rail) => rail.categories);

  let venueQuery = s
    .from("venues")
    .select(VENUE_FIELDS)
    .eq("is_active", true)
    .in("age_restriction", allowedAges)
    .in("category", categories)
    .order("is_trending", { ascending: false })
    .limit(limitPerRail * NIGHTLIFE_RAILS.length);
  if (city) venueQuery = venueQuery.eq("city", city);

  // RLS on `events` already hides anything expired or inactive, but the
  // service-role client bypasses RLS — so the window is repeated here.
  const nowIso = new Date().toISOString();
  let eventQuery = s
    .from("events")
    .select("id, title, description, city, neighborhood, starts_at, ends_at, age_restriction, event_type, cover_image_url, ticket_url, price_from_aed, venues(id, name, neighborhood)")
    .eq("is_active", true)
    .in("age_restriction", allowedAges)
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(12);
  if (city) eventQuery = eventQuery.eq("city", city);

  const [{ data: venues }, { data: events }] = await Promise.all([venueQuery, eventQuery]);

  const hydrated = await withCovers(venues || [], { maxMediaPerVenue: 3 });
  const rails = NIGHTLIFE_RAILS.map((rail) => ({
    ...rail,
    venues: hydrated.filter((v) => rail.categories.includes(v.category)).slice(0, limitPerRail),
  })).filter((rail) => rail.venues.length > 0);

  return {
    rails,
    events: events || [],
    isEmpty: rails.length === 0 && (events || []).length === 0,
  };
}
