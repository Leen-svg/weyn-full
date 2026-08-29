import "server-only";
import { db } from "@/lib/db";

// The two dated/commercial rails that sit above the organic content on Home.
//
// Both are age-filtered by the caller's tier and both return an empty array
// rather than a placeholder when there is nothing real to show — an empty rail
// at the top of Home is the same trust tax as the community feed that was just
// removed, so the section unmounts entirely instead.

export async function getUpcomingEvents(allowedAges, { limit = 12, city = null } = {}) {
  const nowIso = new Date().toISOString();
  let q = db()
    .from("events")
    .select("id, title, description, city, neighborhood, starts_at, ends_at, age_restriction, event_type, cover_image_url, ticket_url, price_from_aed, venues(id, name, neighborhood)")
    .eq("is_active", true)
    .in("age_restriction", allowedAges)
    // RLS enforces the same window, but the service-role client bypasses RLS.
    .or(`ends_at.gt.${nowIso},and(ends_at.is.null,starts_at.gt.${nowIso})`)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (city) q = q.eq("city", city);

  const { data, error } = await q;
  if (error) return [];
  return data || [];
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
