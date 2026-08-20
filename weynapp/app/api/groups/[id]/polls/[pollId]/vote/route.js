import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

export async function POST(req, { params }) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { pollId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const limited = await rateLimit(req, "group-poll-vote", 60, 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "Too many votes. Try again later." }, { status: 429 });

  const { optionId } = await req.json();
  if (!optionId) return NextResponse.json({ error: "optionId required" }, { status: 400 });

  const { data: poll } = await supabase.from("group_polls").select("expires_at").eq("id", pollId).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (new Date(poll.expires_at) < new Date()) return NextResponse.json({ error: "Voting has closed" }, { status: 400 });
  const { data: option } = await supabase
    .from("group_poll_options")
    .select("id")
    .eq("id", optionId)
    .eq("poll_id", pollId)
    .maybeSingle();
  if (!option) return NextResponse.json({ error: "That option is not part of this poll" }, { status: 400 });

  const { error } = await supabase
    .from("group_poll_votes")
    .upsert({ poll_id: pollId, option_id: optionId, user_id: user.id }, { onConflict: "poll_id,user_id" });
  if (error) return NextResponse.json({ error: "Couldn't save that vote" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

