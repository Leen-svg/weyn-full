import { NextResponse } from "next/server";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { pollAccess } from "@/lib/poll-access";

export async function POST(req, { params }) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "poll-vote", 60, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many votes. Try again later." }, { status: 429 });
  const { code } = await params;
  const { optionId, name, fingerprint } = await req.json();
  if (!optionId || !fingerprint) return NextResponse.json({ error: "Missing vote data" }, { status: 400 });

  const access = await pollAccess(req, code);
  if (!access.allowed) return NextResponse.json({ error: access.error }, { status: access.status });
  const { poll, service: s } = access;
  if (new Date(poll.expires_at) < new Date()) return NextResponse.json({ error: "This poll has expired" }, { status: 410 });

  const { data: option } = await s
    .from("poll_options")
    .select("id")
    .eq("id", optionId)
    .eq("poll_id", poll.id)
    .maybeSingle();
  if (!option) return NextResponse.json({ error: "That option is not part of this poll" }, { status: 400 });

  // one vote per person; re-voting replaces the old vote
  await s.from("votes").delete().eq("poll_id", poll.id).eq("voter_fingerprint", fingerprint);
  const { error } = await s.from("votes").insert({
    poll_id: poll.id,
    poll_option_id: optionId,
    voter_fingerprint: fingerprint,
    voter_name: (name || "").slice(0, 40) || null,
  });
  if (error) return NextResponse.json({ error: "Couldn't save that vote" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

