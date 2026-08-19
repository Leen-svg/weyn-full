import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const { pollId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const { optionId } = await req.json();
  if (!optionId) return NextResponse.json({ error: "optionId required" }, { status: 400 });

  const { data: poll } = await supabase.from("group_polls").select("expires_at").eq("id", pollId).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (new Date(poll.expires_at) < new Date()) return NextResponse.json({ error: "Voting has closed" }, { status: 400 });

  const { error } = await supabase
    .from("group_poll_votes")
    .upsert({ poll_id: pollId, option_id: optionId, user_id: user.id }, { onConflict: "poll_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
