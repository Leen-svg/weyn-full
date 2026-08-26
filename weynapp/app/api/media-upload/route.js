import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { contentAccountError } from "@/lib/content-safety";
import { COMMUNITY_IMAGE_MAX_BYTES, COMMUNITY_IMAGE_TYPES, imageExtension } from "@/lib/community-media.mjs";
import { QUARANTINE_BUCKET } from "@/lib/community-media-server";
import { isVisibility } from "@/lib/visibility.mjs";
import { rateLimit } from "@/lib/request-security";

export async function POST(req) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > COMMUNITY_IMAGE_MAX_BYTES + 128 * 1024) return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 413 });
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to upload a photo" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });
  const limited = await rateLimit(req, "community-photo", 12, 24 * 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "You've reached today's photo limit" }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  const contextType = String(form.get("contextType") || "");
  const venueId = String(form.get("venueId") || "").trim() || null;
  const visibility = String(form.get("visibility") || "");
  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  if (!COMMUNITY_IMAGE_TYPES.includes(file.type) || file.size < 1 || file.size > COMMUNITY_IMAGE_MAX_BYTES) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image up to 5 MB" }, { status: 400 });
  if (!['post', 'review'].includes(contextType)) return NextResponse.json({ error: "Invalid photo context" }, { status: 400 });
  if (!isVisibility(visibility)) return NextResponse.json({ error: "Choose who can see this photo" }, { status: 400 });
  if (contextType === "review" && !venueId) return NextResponse.json({ error: "Choose a place first" }, { status: 400 });
  if (venueId) {
    const { data: venue } = await db().from("venues").select("id").eq("id", venueId).maybeSingle();
    if (!venue) return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = imageExtension(bytes, file.type);
  if (!extension) return NextResponse.json({ error: "That file does not match its image type" }, { status: 400 });
  const mediaId = crypto.randomUUID();
  const storagePath = `${user.id}/${mediaId}.${extension}`;
  const service = db();
  const { error: uploadError } = await service.storage.from(QUARANTINE_BUCKET).upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Couldn't upload that image" }, { status: 500 });
  const { error: rowError } = await service.from("community_media").insert({
    id: mediaId, user_id: user.id, context_type: contextType, venue_id: venueId,
    storage_path: storagePath, mime_type: file.type, byte_size: file.size, visibility,
  });
  if (rowError) {
    await service.storage.from(QUARANTINE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "Couldn't queue that image" }, { status: 500 });
  }
  return NextResponse.json({ mediaId, status: "pending", message: "Photo uploaded privately and sent for review." });
}
