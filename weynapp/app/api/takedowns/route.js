import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "takedown", 5, 24 * 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many requests. Email hello@goweyn.com if this is urgent." }, { status: 429 });
  const b = await req.json();
  const url = (b.video_url || "").trim();
  const handle = (b.creator_handle || "").trim().replace(/^@/, "").toLowerCase();
  if (!/^https?:\/\//i.test(url) || !/^[a-z0-9._-]{2,40}$/i.test(handle)) return NextResponse.json({ error: "A valid video link and handle are required" }, { status: 400 });

  const s = db();
  const { error } = await s.from("takedown_requests").insert({
    video_url: url.slice(0, 500),
    creator_handle: handle,
    contact_email: String(b.contact_email || "").trim().slice(0, 254) || null,
    reason: (b.reason || "").slice(0, 400) || null,
  });
  if (error) return NextResponse.json({ error: "Couldn't submit that request" }, { status: 500 });

  // Immediately flag any matching submitted video so it stops being served.
  await s.from("video_submissions").update({ status: "takedown_requested" }).eq("tiktok_url", url.slice(0, 500));

  return NextResponse.json({ ok: true });
}

