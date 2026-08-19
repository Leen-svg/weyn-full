import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  const b = await req.json();
  const url = (b.video_url || "").trim();
  const handle = (b.creator_handle || "").trim().replace(/^@/, "").toLowerCase();
  if (!url || !handle) return NextResponse.json({ error: "Video link and handle are required" }, { status: 400 });

  const s = db();
  const { error } = await s.from("takedown_requests").insert({
    video_url: url,
    creator_handle: handle,
    contact_email: (b.contact_email || "").trim() || null,
    reason: (b.reason || "").slice(0, 400) || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Immediately flag any matching submitted video so it stops being served.
  await s.from("video_submissions").update({ status: "takedown_requested" }).eq("tiktok_url", url);

  return NextResponse.json({ ok: true });
}
