import { db } from "./db";

// Shared pipeline for the "curation batch" venue format produced by the
// scraping/tagging pipeline (one JSON object per line: { venue_id, name,
// curation: {...tag buckets, estimated_spend_aed}, metadata: {lat, lng,
// gallery_images / hero_image_url, opening_hours} }).
//
// Used by the admin bulk-import endpoint so new batches can be dropped in
// without a manual data-migration pass each time.

export const CURATION_CATEGORIES = [
  ["access_and_rules", "access-and-rules", "Access & Rules"],
  ["vibe_and_noise", "vibe-and-noise", "Vibe & Noise"],
  ["substance_and_value", "substance-and-value", "Substance & Value"],
  ["occasion", "occasion", "Occasion"],
  ["logistics", "logistics", "Logistics"],
  ["climate_and_seating", "climate-and-seating", "Climate & Seating"],
  ["dietary_and_lifestyle", "dietary-and-lifestyle", "Dietary & Lifestyle"],
];

// Approximate real-world centroids for the currently-active Abu Dhabi zones.
const AD_ZONES = [
  ["abudhabi-yas-island", 24.4672, 54.6031],
  ["abudhabi-saadiyat-island", 24.5455, 54.4318],
  ["abudhabi-al-reem-and-al-maryah", 24.4959, 54.4013],
  ["abudhabi-al-bateen-and-marina", 24.465, 54.327],
  ["abudhabi-al-mina-and-mina-zayed", 24.5125, 54.378],
  ["abudhabi-khalifa-city-and-masdar", 24.415, 54.6],
  ["abudhabi-downtown-and-al-zahiyah", 24.493, 54.37],
  ["abudhabi-mushrif-and-karamah", 24.445, 54.39],
];
const ZONE_NAMES = {
  "abudhabi-yas-island": "Yas Island",
  "abudhabi-saadiyat-island": "Saadiyat Island",
  "abudhabi-al-reem-and-al-maryah": "Al Reem & Al Maryah",
  "abudhabi-al-bateen-and-marina": "Al Bateen & Marina",
  "abudhabi-al-mina-and-mina-zayed": "Al Mina & Mina Zayed",
  "abudhabi-khalifa-city-and-masdar": "Khalifa City & Masdar",
  "abudhabi-downtown-and-al-zahiyah": "Downtown & Al Zahiyah",
  "abudhabi-mushrif-and-karamah": "Mushrif & Karamah",
};

export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nearestZone(lat, lng) {
  let best = null,
    bestD = Infinity;
  for (const [slug, zLat, zLng] of AD_ZONES) {
    const d = Math.hypot(lat - zLat, lng - zLng);
    if (d < bestD) {
      bestD = d;
      best = slug;
    }
  }
  return bestD <= 0.09 ? best : null; // ~10km at this latitude
}

function spendMidpoint(band) {
  switch (band) {
    case "Under 100 AED":
      return 50;
    case "100 - 250 AED":
      return 175;
    case "250 - 500 AED":
      return 375;
    case "500+ AED":
      return 600;
    default:
      return 100;
  }
}

// Filters out scraper junk: tracking pixels, tiny icons/logos, non-image URLs.
function isUsableImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/facebook\.com\/tr\?/i.test(url)) return false;
  if (/[?&](w|h)_(1?\d|2\d)[,&]/i.test(url)) return false; // wix-style w_20,h_20 thumbnails/icons
  if (/\/(favicon|logo|icon)[^/]*\.(png|svg|ico)(\?|$)/i.test(url)) return false;
  return true;
}

// The Supabase JS client can occasionally hang on a single request (observed
// during large sequential imports) — bound every call so one stuck row fails
// fast instead of blocking the whole batch indefinitely.
function withTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms))]);
}

export function isCurationFormat(row) {
  return !!(row && typeof row === "object" && row.curation);
}

export function parseJsonlOrArray(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// Imports/updates a batch of curation-format venue records. Idempotent:
// re-running the same file just refreshes tags/media rather than duplicating.
export async function importCurationRecords(records) {
  const s = db();
  const summary = {
    inserted: 0,
    updated: 0,
    newTagsCreated: 0,
    mediaAdded: 0,
    mediaSkippedJunk: 0,
    mediaSkippedDuplicate: 0,
    errors: [],
  };

  // 1. Ensure every category exists.
  const { data: existingCats } = await s.from("categories").select("id, slug");
  const catIdBySlug = Object.fromEntries((existingCats || []).map((c) => [c.slug, c.id]));
  let order = (existingCats || []).length;
  for (const [, catSlug, catName] of CURATION_CATEGORIES) {
    if (catIdBySlug[catSlug]) continue;
    order += 1;
    const { data, error } = await s
      .from("categories")
      .insert({ slug: catSlug, name: catName, display_order: order, min_select: 0, max_select: 2 })
      .select("id")
      .single();
    if (error) throw error;
    catIdBySlug[catSlug] = data.id;
  }

  // 2. Ensure every tag label referenced by this batch exists (auto-register new ones).
  const { data: existingTags } = await s.from("vibe_tags").select("id, slug, category_id");
  const tagIdBySlug = Object.fromEntries((existingTags || []).map((t) => [t.slug, t.id]));
  const tagOrderByCat = {};
  for (const t of existingTags || []) tagOrderByCat[t.category_id] = (tagOrderByCat[t.category_id] || 0) + 1;

  const newTagRows = [];
  for (const r of records) {
    const c = r.curation || {};
    for (const [key, catSlug] of CURATION_CATEGORIES) {
      for (const label of c[key] || []) {
        const slug = slugify(label);
        if (tagIdBySlug[slug] || newTagRows.some((t) => t.slug === slug)) continue;
        const categoryId = catIdBySlug[catSlug];
        tagOrderByCat[categoryId] = (tagOrderByCat[categoryId] || 0) + 1;
        newTagRows.push({ slug, display_name: label, category_id: categoryId, subgroup: null, subgroup_order: 1, display_order: tagOrderByCat[categoryId], is_active: true });
      }
    }
  }
  if (newTagRows.length) {
    const { data, error } = await s.from("vibe_tags").insert(newTagRows).select("id, slug");
    if (error) throw error;
    for (const t of data) tagIdBySlug[t.slug] = t.id;
    summary.newTagsCreated = data.length;
  }

  // 3. Existing venues by Google Place ID.
  const { data: existingVenues } = await s.from("venues").select("id, google_place_id");
  const venueIdByPlaceId = Object.fromEntries((existingVenues || []).map((v) => [v.google_place_id, v.id]));

  // 4. Detect galleries that repeat across many different venues (generic
  // stock filler) so they don't get imported as if they were venue-specific.
  const galleryUsageCount = {};
  for (const r of records) {
    const urls = (r.metadata?.gallery_images || (r.metadata?.hero_image_url ? [r.metadata.hero_image_url] : [])).filter(isUsableImageUrl);
    if (!urls.length) continue;
    const key = urls.slice().sort().join("|");
    galleryUsageCount[key] = (galleryUsageCount[key] || 0) + 1;
  }

  for (const r of records) {
    try {
      const c = r.curation || {};
      const m = r.metadata || {};
      const lat = m.lat,
        lng = m.lng;
      const city = lat > 24.9 ? "Dubai" : "Abu Dhabi";
      let zoneSlug = null,
        neighborhood = city;
      if (city === "Abu Dhabi") {
        zoneSlug = nearestZone(lat, lng);
        if (zoneSlug) neighborhood = ZONE_NAMES[zoneSlug];
      }

      const fields = {
        name: r.name,
        neighborhood,
        google_maps_url: `https://www.google.com/maps/place/?q=place_id:${r.venue_id}`,
        avg_spend_aed: spendMidpoint(c.estimated_spend_aed),
        is_aesthetic: (c.vibe_and_noise || []).includes("Aesthetic / Instagrammable") || (c.substance_and_value || []).includes("Do it for the Gram"),
        is_active: true,
        zone_slug: zoneSlug,
        age_restriction: (c.access_and_rules || []).includes("Strictly 21+") ? "21-plus" : "all-ages",
        latitude: lat,
        longitude: lng,
        category: c.canonical_type || null,
        cuisine: c.cuisine_primary || null,
        google_place_id: r.venue_id,
        city,
        has_covered_terrace: (c.climate_and_seating || []).includes("AC-Cooled Outdoor Terrace"),
        has_outdoor_seating: (c.climate_and_seating || []).includes("AC-Cooled Outdoor Terrace") || (c.climate_and_seating || []).includes("Sea / Marina View"),
        open_late: (c.occasion || []).includes("Late Night Bites") || (c.dietary_and_lifestyle || []).includes("Late Night Dining"),
        has_shisha: (c.access_and_rules || []).includes("Shisha Served"),
        opening_hours: m.opening_hours || [],
      };

      let venueId = venueIdByPlaceId[r.venue_id];
      if (venueId) {
        const { error } = await withTimeout(s.from("venues").update(fields).eq("id", venueId), 8000, "venues.update");
        if (error) throw error;
        summary.updated++;
      } else {
        const { data, error } = await withTimeout(s.from("venues").insert(fields).select("id").single(), 8000, "venues.insert");
        if (error) throw error;
        venueId = data.id;
        venueIdByPlaceId[r.venue_id] = venueId;
        summary.inserted++;
      }

      // Refresh tags for this venue.
      const tagIds = [];
      for (const [key] of CURATION_CATEGORIES) {
        for (const label of c[key] || []) {
          const id = tagIdBySlug[slugify(label)];
          if (id) tagIds.push(id);
        }
      }
      await withTimeout(s.from("venue_tags").delete().eq("venue_id", venueId), 8000, "venue_tags.delete");
      if (tagIds.length) {
        const { error } = await withTimeout(s.from("venue_tags").insert(tagIds.map((tag_id) => ({ venue_id: venueId, tag_id }))), 8000, "venue_tags.insert");
        if (error) throw error;
      }

      // Refresh media only if this batch brought genuinely usable, non-generic photos.
      const rawUrls = m.gallery_images || (m.hero_image_url ? [m.hero_image_url] : []);
      const usable = rawUrls.filter(isUsableImageUrl);
      const junkCount = rawUrls.length - usable.length;
      summary.mediaSkippedJunk += junkCount;
      if (usable.length) {
        const key = usable.slice().sort().join("|");
        if (galleryUsageCount[key] > 2) {
          summary.mediaSkippedDuplicate += usable.length;
        } else {
          await withTimeout(s.from("venue_media").delete().eq("venue_id", venueId), 8000, "venue_media.delete");
          const { error } = await withTimeout(
            s.from("venue_media").insert(usable.map((url) => ({ venue_id: venueId, url, media_type: "image" }))),
            8000,
            "venue_media.insert"
          );
          if (error) throw error;
          summary.mediaAdded += usable.length;
        }
      }
    } catch (e) {
      summary.errors.push(`${r.name || r.venue_id}: ${e.message}`);
    }
  }

  return summary;
}
