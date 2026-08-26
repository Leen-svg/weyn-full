import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";
import { NextResponse } from "next/server";

const MIME_TYPES = new Map([
  ["image/jpeg", { type: "image", ext: "jpg", max: 5 * 1024 * 1024 }],
  ["image/png", { type: "image", ext: "png", max: 5 * 1024 * 1024 }],
  ["image/webp", { type: "image", ext: "webp", max: 5 * 1024 * 1024 }],
  ["video/mp4", { type: "video", ext: "mp4", max: 50 * 1024 * 1024 }],
  ["video/webm", { type: "video", ext: "webm", max: 50 * 1024 * 1024 }],
  ["video/quicktime", { type: "video", ext: "mov", max: 50 * 1024 * 1024 }],
]);

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venueId");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { data, error } = await db().from("venue_media").select("*").eq("venue_id", venueId).order("display_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ media: data || [] });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { intent, venueId } = body;
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });
  const s = db();
  if (intent === "url") {
    const mediaType = body.mediaType;
    const url = normalizeHttpUrl(body.url);
    if (!["image", "video"].includes(mediaType)) return NextResponse.json({ error: "Choose image or video" }, { status: 400 });
    if (!url || url.length > 2000) return NextResponse.json({ error: "Enter a valid public http(s) URL" }, { status: 400 });
    const { data: existing } = await s.from("venue_media").select("id").eq("venue_id", venueId).eq("url", url).maybeSingle();
    if (existing) return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
    const { count, error: countError } = await s.from("venue_media").select("id", { count: "exact", head: true }).eq("venue_id", venueId);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count || 0) >= 60) return NextResponse.json({ error: "A venue can have up to 60 media items" }, { status: 400 });
    const { data, error } = await s.from("venue_media").insert({ venue_id: venueId, url, media_type: mediaType, caption: body.caption?.trim().slice(0, 180) || null, display_order: count || 0 }).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, url });
  }
  if (intent === "sign") {
    const contentType = String(body.contentType || "");
    const rule = MIME_TYPES.get(contentType);
    const fileSize = Number(body.fileSize);
    if (!rule) return NextResponse.json({ error: "Unsupported image or video type" }, { status: 400 });
    if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > rule.max) return NextResponse.json({ error: "File is too large" }, { status: 400 });
    const path = `${venueId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${rule.ext}`;
    const { data, error } = await s.storage.from("venue-media").createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: pub } = s.storage.from("venue-media").getPublicUrl(path);
    return NextResponse.json({ path, token: data.token, publicUrl: pub.publicUrl, mediaType: rule.type });
  }

  if (intent === "complete") {
    const { path, mediaType, caption } = body;
    if (!path || !["image", "video"].includes(mediaType)) {
      return NextResponse.json({ error: "Incomplete media upload" }, { status: 400 });
    }
    if (!String(path).startsWith(`${venueId}/`)) return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
    const { data: stored, error: storedError } = await s.storage.from("venue-media").list(venueId, { search: String(path).slice(`${venueId}/`.length), limit: 1 });
    if (storedError || !stored?.some((item) => `${venueId}/${item.name}` === path)) return NextResponse.json({ error: "Uploaded file was not found" }, { status: 400 });
    const { data: pub } = s.storage.from("venue-media").getPublicUrl(path);
    const publicUrl = pub.publicUrl;
    const { error } = await s.from("venue_media").insert({
      venue_id: venueId,
      url: publicUrl,
      media_type: mediaType,
      caption: caption?.trim().slice(0, 180) || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: publicUrl });
  }

  return NextResponse.json({ error: "Unknown upload intent" }, { status: 400 });
}

export async function DELETE(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const s = db();
  const { data: media, error: readError } = await s.from("venue_media").select("url").eq("id", id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const { error } = await s.from("venue_media").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const marker = "/storage/v1/object/public/venue-media/";
  const markerIndex = media.url?.indexOf(marker) ?? -1;
  if (markerIndex >= 0) {
    const storagePath = decodeURIComponent(media.url.slice(markerIndex + marker.length));
    await s.storage.from("venue-media").remove([storagePath]);
  }
  return NextResponse.json({ ok: true });
}

