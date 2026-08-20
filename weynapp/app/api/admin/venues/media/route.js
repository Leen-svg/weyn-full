import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

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
    const mediaType = contentType.startsWith("video/") ? "video" : contentType.startsWith("image/") ? "image" : null;
    if (!mediaType) return NextResponse.json({ error: "Only image and video files are supported" }, { status: 400 });
    const extension = String(body.fileName || "upload").split(".").pop().replace(/[^a-z0-9]/gi, "").slice(0, 8) || (mediaType === "image" ? "webp" : "mp4");
    const path = `${venueId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension.toLowerCase()}`;
    const { data, error } = await s.storage.from("venue-media").createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: pub } = s.storage.from("venue-media").getPublicUrl(path);
    return NextResponse.json({ path, token: data.token, publicUrl: pub.publicUrl, mediaType });
  }

  if (intent === "complete") {
    const { path, publicUrl, mediaType, caption } = body;
    if (!path || !publicUrl || !["image", "video"].includes(mediaType)) {
      return NextResponse.json({ error: "Incomplete media upload" }, { status: 400 });
    }
    if (!String(path).startsWith(`${venueId}/`)) return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
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

