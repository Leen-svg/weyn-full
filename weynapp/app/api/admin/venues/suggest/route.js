import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

function priceToAed(level) {
  return { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 50, PRICE_LEVEL_MODERATE: 120, PRICE_LEVEL_EXPENSIVE: 250, PRICE_LEVEL_VERY_EXPENSIVE: 450 }[level] ?? 0;
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { placeId } = await req.json();
  if (!placeId?.trim()) return NextResponse.json({ error: "Google Place ID required" }, { status: 400 });

  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!googleKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured in Vercel" }, { status: 503 });

  const placeRes = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId.trim())}`, {
    headers: {
      "X-Goog-Api-Key": googleKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,location,priceLevel,types,primaryTypeDisplayName,editorialSummary,googleMapsUri",
    },
    cache: "no-store",
  });
  const place = await placeRes.json();
  if (!placeRes.ok) return NextResponse.json({ error: place.error?.message || "Could not load that Google place" }, { status: 400 });

  const s = db();
  const [{ data: categories }, { data: tags }] = await Promise.all([
    s.from("categories").select("id, slug, name"),
    s.from("vibe_tags").select("id, category_id, slug, display_name").eq("is_active", true),
  ]);
  const categoryMap = Object.fromEntries((categories || []).map((category) => [category.id, category.name]));
  const allowedTags = (tags || []).map((tag) => ({ ...tag, category: categoryMap[tag.category_id] || "Other" }));

  let suggestedSlugs = [];
  let aiDescription = place.editorialSummary?.text || "";
  const aiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const aiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const aiModel = process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (aiKey) {
    const aiRes = await fetch(aiUrl, {
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
    const aiData = await aiRes.json();
    if (!aiRes.ok) return NextResponse.json({ error: aiData.error?.message || "AI tag suggestion failed" }, { status: 502 });
    try {
      const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
      suggestedSlugs = Array.isArray(parsed.tag_slugs) ? parsed.tag_slugs : [];
      aiDescription = typeof parsed.description === "string" ? parsed.description : aiDescription;
    } catch {
      return NextResponse.json({ error: "AI returned an unreadable tag suggestion" }, { status: 502 });
    }
  } else {
    return NextResponse.json({ error: "AI_API_KEY (or OPENAI_API_KEY) is not configured in Vercel" }, { status: 503 });
  }

  const validSlugSet = new Set(suggestedSlugs);
  const addressParts = place.addressComponents || [];
  const area = addressParts.find((part) => part.types?.some((type) => ["neighborhood", "sublocality_level_1", "sublocality"].includes(type)))?.longText || "";
  const city = /dubai/i.test(place.formattedAddress || "") ? "Dubai" : "Abu Dhabi";

  return NextResponse.json({
    place: {
      name: place.displayName?.text || "",
      neighborhood: area,
      city,
      avg_spend_aed: priceToAed(place.priceLevel),
      description: aiDescription.slice(0, 1000),
      google_maps_url: place.googleMapsUri || "",
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
    },
    tag_ids: allowedTags.filter((tag) => validSlugSet.has(tag.slug)).map((tag) => tag.id),
  });
}


