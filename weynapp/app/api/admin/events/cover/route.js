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
const FOLDER = "event-covers";

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const service = db();

  if (body.intent === "sign") {
    const extension = MIME_TYPES.get(String(body.contentType || ""));
    const fileSize = Number(body.fileSize);
    if (!extension) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image" }, { status: 400 });
    if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 400 });
    const path = `${FOLDER}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    const { data, error } = await service.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ path, token: data.token });
  }

  if (body.intent === "complete") {
    const path = String(body.path || "");
    if (!path.startsWith(`${FOLDER}/`)) return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
    const filename = path.slice(FOLDER.length + 1);
    const { data: stored, error } = await service.storage.from(BUCKET).list(FOLDER, { search: filename, limit: 1 });
    if (error || !stored?.some((item) => item.name === filename)) return NextResponse.json({ error: "Uploaded image was not found" }, { status: 400 });
    const { data } = service.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl });
  }

  return NextResponse.json({ error: "Unknown upload intent" }, { status: 400 });
}
