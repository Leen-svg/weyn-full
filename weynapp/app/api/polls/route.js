import { db } from "@/lib/db";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";

export async function POST(req) {
  const { tags, maxSpend, aestheticOnly, zones, venueIds } = await req.json();
  if (!Array.isArray(venueIds) || venueIds.length === 0) {
    return NextResponse.json({ error: "No venues to vote on" }, { status: 400 });
  }
  const s = db();
  const { data: poll, error } = await s
    .from("polls")
    .insert({
      selected_tag_slugs: tags || [],
      max_spend_aed: maxSpend || null,
      aesthetic_only: !!aestheticOnly,
      zone_slugs: zones || null,
    })
    .select("id, short_code")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: e2 } = await s
    .from("poll_options")
    .insert(venueIds.map((v) => ({ poll_id: poll.id, venue_id: v })));
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // Award "shared a spot" points if the creator is logged in, anonymous
  // sharing stays fully supported, it just doesn't earn points.
  try {
    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (user) await awardPoints(user.id, POINTS.shared_a_spot, "shared_a_spot");
  } catch {
    // points are a bonus, never block poll creation over it
  }

  return NextResponse.json({ code: poll.short_code });
}
