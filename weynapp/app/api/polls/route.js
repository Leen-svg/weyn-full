import { db } from "@/lib/db";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";
import { cleanStringList, payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "poll-create", 10, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many polls. Try again later." }, { status: 429 });
  const { tags, maxSpend, aestheticOnly, zones, venueIds } = await req.json();
  const ids = cleanStringList(venueIds, { maxItems: 6, maxLength: 36 }).filter((id) => UUID.test(id));
  if (ids.length === 0) {
    return NextResponse.json({ error: "No venues to vote on" }, { status: 400 });
  }
  const s = db();
  const { data: activeVenues } = await s.from("venues").select("id").eq("is_active", true).in("id", ids);
  if ((activeVenues || []).length !== ids.length) {
    return NextResponse.json({ error: "One or more venues are unavailable" }, { status: 400 });
  }
  const { data: poll, error } = await s
    .from("polls")
    .insert({
      selected_tag_slugs: cleanStringList(tags),
      max_spend_aed: Number.isFinite(Number(maxSpend)) ? Math.max(0, Math.min(100000, Number(maxSpend))) : null,
      aesthetic_only: !!aestheticOnly,
      zone_slugs: cleanStringList(zones) || null,
    })
    .select("id, short_code")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't create that poll" }, { status: 500 });

  const { error: e2 } = await s
    .from("poll_options")
    .insert(ids.map((v) => ({ poll_id: poll.id, venue_id: v })));
  if (e2) {
    await s.from("polls").delete().eq("id", poll.id);
    return NextResponse.json({ error: "Couldn't add choices to that poll" }, { status: 500 });
  }

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

