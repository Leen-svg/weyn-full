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

  const form = await req.formData();
  const venueId = form.get("venueId");
  const file = form.get("file");
  const caption = form.get("caption") || null;
  if (!venueId || !file) return NextResponse.json({ error: "venueId and file required" }, { status: 400 });

  const mediaType = file.type?.startsWith("video/") ? "video" : "image";
  const ext = file.name.split(".").pop();
  const path = `${venueId}/${Date.now()}.${ext}`;

  const s = db();
  const { error: upErr } = await s.storage.from("venue-media").upload(path, file, { contentType: file.type });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = s.storage.from("venue-media").getPublicUrl(path);

  const { error } = await s.from("venue_media").insert({
    venue_id: venueId,
    url: pub.publicUrl,
    media_type: mediaType,
    caption,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}

export async function DELETE(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db().from("venue_media").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
