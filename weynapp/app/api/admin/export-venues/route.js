import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { CURATION_CATEGORIES } from "@/lib/venueImport";
import { NextResponse } from "next/server";

// Reverses avg_spend_aed back into the same band strings the importer accepts,
// so an exported file round-trips cleanly through the importer unmodified.
function spendBand(aed) {
  if (aed == null) return null;
  if (aed < 100) return "Under 100 AED";
  if (aed < 250) return "100 - 250 AED";
  if (aed < 500) return "250 - 500 AED";
  return "500+ AED";
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = db();
  const { data: venues, error } = await s
    .from("venues")
    .select("id, name, google_place_id, latitude, longitude, avg_spend_aed, age_restriction, is_aesthetic, canonical_type:category, cuisine, has_covered_terrace, has_outdoor_seating, open_late, has_shisha, opening_hours")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const venueIds = venues.map((v) => v.id);
  const [{ data: tagLinks }, { data: media }] = await Promise.all([
    s.from("venue_tags").select("venue_id, vibe_tags(slug, display_name, categories(slug))").in("venue_id", venueIds),
    s.from("venue_media").select("venue_id, url").in("venue_id", venueIds).eq("media_type", "image"),
  ]);

  const tagsByVenue = {};
  for (const link of tagLinks || []) {
    const catSlug = link.vibe_tags?.categories?.slug;
    const label = link.vibe_tags?.display_name;
    if (!catSlug || !label) continue;
    (tagsByVenue[link.venue_id] ||= {})[catSlug] ||= [];
    tagsByVenue[link.venue_id][catSlug].push(label);
  }
  const mediaByVenue = {};
  for (const m of media || []) (mediaByVenue[m.venue_id] ||= []).push(m.url);

  const catSlugToKey = Object.fromEntries(CURATION_CATEGORIES.map(([key, slug]) => [slug, key]));

  const lines = venues.map((v) => {
    const curation = {
      status: "approved",
      rejection_reason: null,
      canonical_type: v.canonical_type,
      access_and_rules: [],
      vibe_and_noise: [],
      substance_and_value: [],
      occasion: [],
      logistics: [],
      climate_and_seating: [],
      dietary_and_lifestyle: [],
      cuisine_primary: v.cuisine,
      estimated_spend_aed: spendBand(v.avg_spend_aed),
    };
    for (const [catSlug, labels] of Object.entries(tagsByVenue[v.id] || {})) {
      const key = catSlugToKey[catSlug];
      if (key) curation[key] = labels;
    }
    return JSON.stringify({
      venue_id: v.google_place_id,
      name: v.name,
      curation,
      metadata: {
        lat: v.latitude,
        lng: v.longitude,
        website: null,
        phone: null,
        opening_hours: v.opening_hours || [],
        hero_image_url: null,
        gallery_images: mediaByVenue[v.id] || [],
      },
    });
  });

  const body = lines.join("\n");
  const filename = `weyn-venues-export-${new Date().toISOString().slice(0, 10)}.jsonl`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

