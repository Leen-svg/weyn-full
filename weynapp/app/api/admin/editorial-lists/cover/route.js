import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "venue-media";

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const s = db();

  if (body.intent === "sign") {
    const ext = MIME_TYPES.get(String(body.contentType || ""));
    const fileSize = Number(body.fileSize);
    if (!ext) return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) return NextResponse.json({ error: "File is too large" }, { status: 400 });
    const path = `editorial-covers/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { data, error } = await s.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: pub } = s.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ path, token: data.token, publicUrl: pub.publicUrl });
  }

  if (body.intent === "complete") {
    const path = String(body.path || "");
    if (!path.startsWith("editorial-covers/")) return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
    const { data: stored, error: storedError } = await s.storage.from(BUCKET).list("editorial-covers", { search: path.slice("editorial-covers/".length), limit: 1 });
    if (storedError || !stored?.some((item) => `editorial-covers/${item.name}` === path)) {
      return NextResponse.json({ error: "Uploaded file was not found" }, { status: 400 });
    }
    const { data: pub } = s.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: pub.publicUrl });
  }

  return NextResponse.json({ error: "Unknown upload intent" }, { status: 400 });
}
