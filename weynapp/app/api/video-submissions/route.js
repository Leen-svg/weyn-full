import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

function normHandle(h) {
  return (h || "").trim().replace(/^@/, "").toLowerCase();
}

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "video-submission", 5, 24 * 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "You've reached today's submission limit." }, { status: 429 });
  const b = await req.json();
  const url = (b.tiktok_url || "").trim();
  const handle = normHandle(b.creator_handle);

  if (!/^https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//i.test(url)) {
    return NextResponse.json({ error: "That doesn't look like a TikTok link" }, { status: 400 });
  }
  if (!/^[a-z0-9._-]{2,40}$/i.test(handle)) return NextResponse.json({ error: "Enter a valid TikTok handle" }, { status: 400 });
  if (!b.venue_id && !(b.venue_name_free || "").trim()) {
    return NextResponse.json({ error: "Tell us which venue the video is for" }, { status: 400 });
  }

  // Ownership check: full tiktok.com/@handle/ links must match the handle given.
  const m = url.match(/tiktok\.com\/@([\w.\-]+)/i);
  if (m && m[1].toLowerCase() !== handle) {
    return NextResponse.json(
      { error: "The handle in the link doesn't match the handle you entered. We only accept your own videos." },
      { status: 400 }
    );
  }

  const s = db();
  const { data: dupe } = await s.from("video_submissions").select("id").eq("tiktok_url", url).limit(1);
  if (dupe && dupe.length) return NextResponse.json({ error: "That video is already in the queue." }, { status: 409 });

  const { error } = await s.from("video_submissions").insert({
    venue_id: b.venue_id || null,
    venue_name_free: b.venue_id ? null : String(b.venue_name_free || "").trim().slice(0, 120),
    tiktok_url: url,
    creator_handle: handle,
    contact_email: String(b.contact_email || "").trim().slice(0, 254) || null,
  });
  if (error) return NextResponse.json({ error: "Couldn't submit that video" }, { status: 500 });
  return NextResponse.json({ ok: true });
}


