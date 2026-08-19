import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function normHandle(h) {
  return (h || "").trim().replace(/^@/, "").toLowerCase();
}

export async function POST(req) {
  const b = await req.json();
  const url = (b.tiktok_url || "").trim();
  const handle = normHandle(b.creator_handle);

  if (!/^https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//i.test(url)) {
    return NextResponse.json({ error: "That doesn't look like a TikTok link" }, { status: 400 });
  }
  if (!handle) return NextResponse.json({ error: "Your TikTok handle is required" }, { status: 400 });
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
    venue_name_free: b.venue_id ? null : (b.venue_name_free || "").trim(),
    tiktok_url: url,
    creator_handle: handle,
    contact_email: (b.contact_email || "").trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
