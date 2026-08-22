import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";
import { safeUrl } from "@/lib/sanitize";

const MIME_TYPES = new Map([
  ["image/jpeg", { type: "image", ext: "jpg", max: 5 * 1024 * 1024 }],
  ["image/png", { type: "image", ext: "png", max: 5 * 1024 * 1024 }],
  ["image/webp", { type: "image", ext: "webp", max: 5 * 1024 * 1024 }],
  ["video/mp4", { type: "video", ext: "mp4", max: 50 * 1024 * 1024 }],
  ["video/webm", { type: "video", ext: "webm", max: 50 * 1024 * 1024 }],
  ["video/quicktime", { type: "video", ext: "mov", max: 50 * 1024 * 1024 }],
]);

async function nextDisplayOrder(client, venueId) {
  const { data } = await client
    .from("venue_media")
    .select("display_order")
    .eq("venue_id", venueId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? Number(data.display_order || 0) + 1 : 0;
}

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

  if (intent === "link") {
    const mediaType = String(body.mediaType || "");
    const rawUrl = String(body.url || "").trim();
    const url = /^https?:\/\//i.test(rawUrl) ? safeUrl(rawUrl) : null;
    if (!url || url.length > 2000) return NextResponse.json({ error: "Enter a valid http(s) media URL" }, { status: 400 });
    if (!["image", "video"].includes(mediaType)) return NextResponse.json({ error: "Choose image or video" }, { status: 400 });
    const displayOrder = await nextDisplayOrder(s, venueId);
    const { data, error } = await s.from("venue_media").insert({
      venue_id: venueId,
      url,
      media_type: mediaType,
      caption: String(body.caption || "").trim().slice(0, 180) || null,
      display_order: displayOrder,
    }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, media: data });
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
    const displayOrder = await nextDisplayOrder(s, venueId);
    const { error } = await s.from("venue_media").insert({
      venue_id: venueId,
      url: publicUrl,
      media_type: mediaType,
      caption: caption?.trim().slice(0, 180) || null,
      display_order: displayOrder,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url: publicUrl });
  }

  return NextResponse.json({ error: "Unknown upload intent" }, { status: 400 });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { venueId, orderedIds } = await req.json();
  const ids = Array.isArray(orderedIds) ? [...new Set(orderedIds.map(String))] : [];
  if (!venueId || !ids.length || ids.length > 100) {
    return NextResponse.json({ error: "venueId and orderedIds are required" }, { status: 400 });
  }

  const s = db();
  const { data: existing, error: readError } = await s.from("venue_media").select("id").eq("venue_id", venueId);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const existingIds = new Set((existing || []).map((item) => String(item.id)));
  if (existingIds.size !== ids.length || ids.some((id) => !existingIds.has(id))) {
    return NextResponse.json({ error: "Media changed while reordering. Refresh and try again." }, { status: 409 });
  }

  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await s.from("venue_media").update({ display_order: index }).eq("venue_id", venueId).eq("id", ids[index]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
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

