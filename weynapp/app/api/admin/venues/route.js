import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";
import { duplicateGoogleMapsVenue, groupDuplicateGoogleMapsVenues } from "@/lib/google-maps-duplicate.mjs";
import { NextResponse } from "next/server";

async function findMapsDuplicate(s, mapsUrl, excludeId = null) {
  if (!mapsUrl) return null;
  const { data, error } = await s.from("venues").select("id,name,neighborhood,city,google_maps_url").not("google_maps_url", "is", null).limit(5000);
  if (error) throw error;
  return duplicateGoogleMapsVenue(data, mapsUrl, excludeId);
}

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const s = db();

  const mapsUrl = (searchParams.get("maps_url") || "").trim();
  if (mapsUrl) {
    try { return NextResponse.json({ duplicate: await findMapsDuplicate(s, mapsUrl, searchParams.get("exclude_id")) }); }
    catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
  }
  if (searchParams.get("maps_audit") === "1") {
    const { data, error } = await s.from("venues").select("id,name,neighborhood,city,google_maps_url").not("google_maps_url", "is", null).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ duplicate_groups: groupDuplicateGoogleMapsVenues(data) });
  }

  let query = s
    .from("venues")
    .select("id, name, neighborhood, zone_slug, city, avg_spend_aed, hero_video_url, menu_url, google_maps_url, description, age_restriction, is_aesthetic, is_trending, trending_rank, is_active, phone, booking_phone, booking_url, website, instagram_url, tiktok_url, venue_tags(tag_id)")
    .order("name")
    .limit(50);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    venues: (data || []).map((venue) => ({
      ...venue,
      tag_ids: (venue.venue_tags || []).map((item) => item.tag_id),
      venue_tags: undefined,
    })),
  });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, neighborhood, city, avg_spend_aed, description, google_maps_url, hero_video_url, menu_url, latitude, longitude, age_restriction, is_aesthetic, is_trending, tag_ids, phone, booking_phone, booking_url, website, instagram_url, tiktok_url } = body;
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const s = db();
  const normalizedMapsUrl = google_maps_url ? normalizeHttpUrl(google_maps_url) : null;
  try {
    const duplicate = await findMapsDuplicate(s, normalizedMapsUrl);
    if (duplicate) return NextResponse.json({ error: `Duplicate Google Maps place: already used by ${duplicate.name}${duplicate.neighborhood ? ` (${duplicate.neighborhood})` : ""}.`, duplicate }, { status: 409 });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
  const { data, error } = await s
    .from("venues")
    .insert({
      name: name.trim(),
      neighborhood: neighborhood?.trim() || null,
      city: city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai",
      avg_spend_aed: Number.isFinite(avg_spend_aed) ? avg_spend_aed : 0,
      description: description?.trim().slice(0, 1000) || null,
      google_maps_url: normalizedMapsUrl,
      hero_video_url: hero_video_url ? normalizeHttpUrl(hero_video_url) : null,
      menu_url: menu_url ? normalizeHttpUrl(menu_url) : null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
      age_restriction: ["18-plus", "21-plus"].includes(age_restriction) ? age_restriction : "all-ages",
      is_aesthetic: !!is_aesthetic,
      is_trending: !!is_trending,
      trending_rank: is_trending ? 1 : null,
      trending_set_at: is_trending ? new Date().toISOString() : null,
      is_active: true,
      phone: phone || null,
      booking_phone: booking_phone || null,
      booking_url: booking_url ? normalizeHttpUrl(booking_url) : null,
      website: website ? normalizeHttpUrl(website) : null,
      instagram_url: instagram_url ? normalizeHttpUrl(instagram_url) : null,
      tiktok_url: tiktok_url ? normalizeHttpUrl(tiktok_url) : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (Array.isArray(tag_ids) && tag_ids.length) {
    const uniqueTagIds = [...new Set(tag_ids.filter((value) => typeof value === "string"))];
    const { data: validTags, error: tagError } = await s.from("vibe_tags").select("id").in("id", uniqueTagIds).eq("is_active", true);
    if (tagError || (validTags || []).length !== uniqueTagIds.length) {
      await s.from("venues").delete().eq("id", data.id);
      return NextResponse.json({ error: tagError?.message || "One or more tags are invalid" }, { status: 400 });
    }
    const { error: insertError } = await s.from("venue_tags").insert(uniqueTagIds.map((tagId) => ({ venue_id: data.id, tag_id: tagId })));
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, patch, tag_ids } = await req.json();
  if (!id || !patch) return NextResponse.json({ error: "id and patch required" }, { status: 400 });

  const allowed = [
    "name",
    "neighborhood",
    "city",
    "avg_spend_aed",
    "hero_video_url",
    "menu_url",
    "google_maps_url",
    "description",
    "is_trending",
    "trending_rank",
    "is_active",
    "latitude",
    "longitude",
    "age_restriction",
    "is_aesthetic",
    "phone",
    "booking_phone",
    "booking_url",
    "website",
    "instagram_url",
    "tiktok_url",
  ];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  if ("hero_video_url" in clean) clean.hero_video_url = clean.hero_video_url ? normalizeHttpUrl(clean.hero_video_url) : null;
  if ("menu_url" in clean) clean.menu_url = clean.menu_url ? normalizeHttpUrl(clean.menu_url) : null;
  if ("google_maps_url" in clean) clean.google_maps_url = clean.google_maps_url ? normalizeHttpUrl(clean.google_maps_url) : null;
  for (const key of ["booking_url", "website", "instagram_url", "tiktok_url"]) {
    if (key in clean) clean[key] = clean[key] ? normalizeHttpUrl(clean[key]) : null;
  }
  // Keep digits and a leading + so a tel: link actually dials.
  for (const key of ["phone", "booking_phone"]) {
    if (key in clean) {
      const digits = String(clean[key] ?? "").replace(/[^\d+]/g, "");
      clean[key] = /\d{6,}/.test(digits) ? digits.slice(0, 32) : null;
    }
  }
  if (clean.is_trending) clean.trending_set_at = new Date().toISOString();

  if (clean.google_maps_url) {
    try {
      const duplicate = await findMapsDuplicate(db(), clean.google_maps_url, id);
      if (duplicate) return NextResponse.json({ error: `Duplicate Google Maps place: already used by ${duplicate.name}${duplicate.neighborhood ? ` (${duplicate.neighborhood})` : ""}.`, duplicate }, { status: 409 });
    } catch (error) { return NextResponse.json({ error: error.message }, { status: 500 }); }
  }

  const { error } = await db().from("venues").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(tag_ids)) {
    const uniqueTagIds = [...new Set(tag_ids.filter((value) => typeof value === "string"))];
    const s = db();
    const { data: validTags, error: tagError } = uniqueTagIds.length
      ? await s.from("vibe_tags").select("id").in("id", uniqueTagIds).eq("is_active", true)
      : { data: [], error: null };
    if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 });
    if ((validTags || []).length !== uniqueTagIds.length) {
      return NextResponse.json({ error: "One or more tags are invalid" }, { status: 400 });
    }

    const { error: deleteError } = await s.from("venue_tags").delete().eq("venue_id", id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    if (uniqueTagIds.length) {
      const { error: insertError } = await s
        .from("venue_tags")
        .insert(uniqueTagIds.map((tagId) => ({ venue_id: id, tag_id: tagId })));
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
