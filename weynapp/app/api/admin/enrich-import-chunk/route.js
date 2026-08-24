import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { importCurationRecords, CURATION_CATEGORIES } from "@/lib/venueImport";
import { NextResponse } from "next/server";

export const maxDuration = 280;

function priceLevelToBand(level) {
  return (
    {
      PRICE_LEVEL_FREE: "Under 100 AED",
      PRICE_LEVEL_INEXPENSIVE: "Under 100 AED",
      PRICE_LEVEL_MODERATE: "100 - 250 AED",
      PRICE_LEVEL_EXPENSIVE: "250 - 500 AED",
      PRICE_LEVEL_VERY_EXPENSIVE: "500+ AED",
    }[level] || "100 - 250 AED"
  );
}

async function fetchPlaceDetails(placeId, googleKey) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": googleKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,priceLevel,types,primaryTypeDisplayName,editorialSummary",
    },
    cache: "no-store",
  });
  const place = await res.json();
  if (!res.ok) throw new Error(place.error?.message || "Place lookup failed");
  return place;
}

async function suggestTags(place, allowedTags, aiKey, aiUrl, aiModel) {
  const res = await fetch(aiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiKey}` },
    body: JSON.stringify({
      model: aiModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You tag UAE venues for Weyn. Return strict JSON with keys tag_slugs (array) and description (one factual sentence, no hype). Only use supplied tag slugs." },
        { role: "user", content: JSON.stringify({ place, allowed_tags: allowedTags.map(({ slug, display_name, category }) => ({ slug, display_name, category })) }) },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "AI tag suggestion failed");
  const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  return { tag_slugs: Array.isArray(parsed.tag_slugs) ? parsed.tag_slugs : [], description: typeof parsed.description === "string" ? parsed.description : "" };
}

async function enrichOne(row, allowedTags, tagCategoryBySlug, googleKey, aiKey, aiUrl, aiModel) {
  const place = await fetchPlaceDetails(row.id, googleKey);
  const { tag_slugs, description } = await suggestTags(place, allowedTags, aiKey, aiUrl, aiModel);

  const curation = { estimated_spend_aed: priceLevelToBand(place.priceLevel), canonical_type: place.primaryTypeDisplayName?.text || null, cuisine_primary: null };
  for (const [key] of CURATION_CATEGORIES) curation[key] = [];
  for (const slug of tag_slugs) {
    const catKey = tagCategoryBySlug[slug];
    if (catKey) curation[catKey].push(allowedTags.find((t) => t.slug === slug)?.display_name);
  }

  return {
    name: row.name,
    venue_id: row.id,
    curation,
    metadata: {
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
      gallery_images: Array.isArray(row.images) ? row.images : [],
      opening_hours: [],
      description,
    },
  };
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const aiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const aiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const aiModel = process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (!googleKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured" }, { status: 503 });
  if (!aiKey) return NextResponse.json({ error: "AI_API_KEY (or OPENAI_API_KEY) is not configured" }, { status: 503 });

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "No rows in chunk" }, { status: 400 });
  if (rows.length > 20) return NextResponse.json({ error: "Max 20 rows per chunk" }, { status: 400 });

  const s = db();
  const [{ data: categories }, { data: tags }] = await Promise.all([
    s.from("categories").select("id, slug"),
    s.from("vibe_tags").select("id, category_id, slug, display_name").eq("is_active", true),
  ]);
  const categorySlugById = Object.fromEntries((categories || []).map((c) => [c.id, c.slug]));
  const catKeyBySlugSuffix = Object.fromEntries(CURATION_CATEGORIES.map(([key, slug]) => [slug, key]));
  const allowedTags = (tags || []).map((t) => ({ ...t, category: categorySlugById[t.category_id] || "other" }));
  const tagCategoryBySlug = Object.fromEntries(allowedTags.map((t) => [t.slug, catKeyBySlugSuffix[t.category] || null]));

  const enriched = [];
  const enrichErrors = [];
  const concurrency = 5;
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((row) => enrichOne(row, allowedTags, tagCategoryBySlug, googleKey, aiKey, aiUrl, aiModel)));
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") enriched.push(result.value);
      else enrichErrors.push(`${batch[idx].name || batch[idx].id}: ${result.reason?.message || "enrich failed"}`);
    });
  }

  const summary = enriched.length ? await importCurationRecords(enriched) : { inserted: 0, updated: 0, newTagsCreated: 0, mediaAdded: 0, errors: [] };
  summary.enrichErrors = enrichErrors;
  return NextResponse.json(summary);
}
