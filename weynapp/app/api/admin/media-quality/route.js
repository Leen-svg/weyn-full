import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const MAX_DELETE_BATCH = 250;
const CATALOGUE_PAGE_SIZE = 1000;
const STORAGE_MARKER = "/storage/v1/object/public/venue-media/";

function storagePathFromUrl(url) {
  const markerIndex = String(url || "").indexOf(STORAGE_MARKER);
  if (markerIndex < 0) return null;
  try {
    return decodeURIComponent(String(url).slice(markerIndex + STORAGE_MARKER.length));
  } catch {
    return null;
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = db();
  const data = [];
  for (let from = 0; ; from += CATALOGUE_PAGE_SIZE) {
    const { data: page, error } = await s
      .from("venue_media")
      .select("id, venue_id, url, media_type, created_at, venues(name)")
      .eq("media_type", "image")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + CATALOGUE_PAGE_SIZE - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data.push(...(page || []));
    if (!page || page.length < CATALOGUE_PAGE_SIZE) break;
  }

  return NextResponse.json({
    images: data.map((item) => ({
      id: item.id,
      venueId: item.venue_id,
      venueName: item.venues?.name || "Unknown venue",
      url: item.url,
      createdAt: item.created_at,
    })),
  });
}

export async function DELETE(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).filter((id) => typeof id === "string"))];
  if (!ids.length) return NextResponse.json({ error: "Choose at least one image" }, { status: 400 });
  if (ids.length > MAX_DELETE_BATCH) {
    return NextResponse.json({ error: `Remove at most ${MAX_DELETE_BATCH} images at once` }, { status: 400 });
  }

  const s = db();
  const { data: images, error: readError } = await s
    .from("venue_media")
    .select("id, url")
    .in("id", ids)
    .eq("media_type", "image");
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!images?.length) return NextResponse.json({ error: "No matching images were found" }, { status: 404 });

  const foundIds = images.map((item) => item.id);
  const { error: deleteError } = await s.from("venue_media").delete().in("id", foundIds);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const storagePaths = images.map((item) => storagePathFromUrl(item.url)).filter(Boolean);
  let storageWarning = null;
  if (storagePaths.length) {
    const { error: storageError } = await s.storage.from("venue-media").remove(storagePaths);
    if (storageError) storageWarning = storageError.message;
  }

  return NextResponse.json({
    ok: true,
    removed: foundIds.length,
    missing: ids.length - foundIds.length,
    storageWarning,
  });
}
