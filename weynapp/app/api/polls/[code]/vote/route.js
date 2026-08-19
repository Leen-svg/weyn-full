import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const { code } = await params;
  const { optionId, name, fingerprint } = await req.json();
  if (!optionId || !fingerprint) return NextResponse.json({ error: "Missing vote data" }, { status: 400 });

  const s = db();
  const { data: poll } = await s.from("polls").select("id, expires_at").eq("short_code", code).single();
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (new Date(poll.expires_at) < new Date()) return NextResponse.json({ error: "This poll has expired" }, { status: 410 });

  // one vote per person; re-voting replaces the old vote
  await s.from("votes").delete().eq("poll_id", poll.id).eq("voter_fingerprint", fingerprint);
  const { error } = await s.from("votes").insert({
    poll_id: poll.id,
    poll_option_id: optionId,
    voter_fingerprint: fingerprint,
    voter_name: (name || "").slice(0, 40) || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
