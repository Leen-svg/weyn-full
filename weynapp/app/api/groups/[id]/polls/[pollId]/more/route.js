import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const { pollId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const { data: poll } = await supabase
    .from("group_polls")
    .select("selected_tag_slugs, max_spend_aed, aesthetic_only, zone_slugs, expires_at")
    .eq("id", pollId)
    .maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (new Date(poll.expires_at) < new Date()) return NextResponse.json({ error: "Voting has closed" }, { status: 400 });

  const { data: existingOptions } = await supabase.from("group_poll_options").select("venue_id").eq("poll_id", pollId);
  const excludeIds = (existingOptions || []).map((o) => o.venue_id);

  const s = db();
  const { data: venues, error: shortlistErr } = await s.rpc("get_shortlist", {
    p_tag_slugs: poll.selected_tag_slugs || [],
    p_max_spend: poll.max_spend_aed || 99999,
    p_aesthetic_only: !!poll.aesthetic_only,
    p_zone_slugs: poll.zone_slugs && poll.zone_slugs.length ? poll.zone_slugs : null,
    p_limit: 3,
    p_exclude_ids: excludeIds,
  });
  if (shortlistErr) return NextResponse.json({ error: shortlistErr.message }, { status: 500 });
  if (!venues?.length) return NextResponse.json({ error: "No more spots match this combo" }, { status: 400 });

  const { error } = await s.from("group_poll_options").insert(venues.map((v) => ({ poll_id: pollId, venue_id: v.id })));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, added: venues.length });
}
