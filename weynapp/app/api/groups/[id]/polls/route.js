import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers } from "@/lib/venueMedia";
import { contentAccountError } from "@/lib/content-safety";
import { cleanStringList, payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

async function shapePolls(supabase, groupId, currentUserId) {
  const { data: polls, error } = await supabase
    .from("group_polls")
    .select("id, group_id, created_by, selected_tag_slugs, max_spend_aed, aesthetic_only, zone_slugs, created_at, expires_at, share_token")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!polls?.length) return [];

  const pollIds = polls.map((p) => p.id);
  const [{ data: options }, { data: votes }, { data: guestVotes }] = await Promise.all([
    supabase.from("group_poll_options").select("id, poll_id, venue_id").in("poll_id", pollIds),
    supabase.from("group_poll_votes").select("poll_id, option_id, user_id").in("poll_id", pollIds),
    supabase.from("group_poll_guest_votes").select("poll_id, option_id, voter_name").in("poll_id", pollIds),
  ]);

  const venueIds = [...new Set((options || []).map((o) => o.venue_id))];
  const s = db();
  const { data: venues } = venueIds.length
    ? await s
        .from("venues")
        .select("id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, menu_url, phone, booking_phone, booking_url, opening_hours, is_aesthetic, age_restriction, description")
        .in("id", venueIds)
    : { data: [] };
  const venuesWithMedia = await withCovers(venues || []);
  const venueMap = Object.fromEntries(venuesWithMedia.map((v) => [v.id, v]));

  const voterIds = [...new Set((votes || []).map((v) => v.user_id))];
  const { data: authors } = voterIds.length
    ? await s.from("profile_public").select("id, display_name").in("id", voterIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));

  return polls.map((p) => {
    const opts = (options || []).filter((o) => o.poll_id === p.id);
    return {
      ...p,
      expired: new Date(p.expires_at) < new Date(),
      options: opts.map((o) => {
        const optVotes = (votes || []).filter((v) => v.option_id === o.id);
        const optGuestVotes = (guestVotes || []).filter((v) => v.option_id === o.id);
        return {
          optionId: o.id,
          venue: venueMap[o.venue_id],
          votes: optVotes.length + optGuestVotes.length,
          voters: [
            ...optVotes.map((v) => authorMap[v.user_id]?.display_name || "Someone"),
            ...optGuestVotes.map((v) => `${v.voter_name || "Guest"} (link)`),
          ],
        };
      }),
      myVote: (votes || []).find((v) => v.poll_id === p.id && v.user_id === currentUserId) || null,
      memberVotersCount: new Set((votes || []).filter((v) => v.poll_id === p.id).map((v) => v.user_id)).size,
    };
  });
}

export async function GET(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  try {
    const polls = await shapePolls(supabase, id, user.id);
    return NextResponse.json({ polls });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });
  const limited = await rateLimit(req, "group-poll", 20, 24 * 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "You've reached today's group poll limit." }, { status: 429 });

  const { tags, maxSpend, aestheticOnly, zones, maxAge } = await req.json();
  const safeTags = cleanStringList(tags);
  const safeZones = cleanStringList(zones);
  if (safeTags.length === 0) {
    return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
  }

  const s = db();
  const { data: venues, error: shortlistErr } = await s.rpc("get_shortlist", {
    p_tag_slugs: safeTags,
    p_max_spend: Number.isFinite(Number(maxSpend)) ? Math.max(0, Math.min(100000, Number(maxSpend))) : 99999,
    p_aesthetic_only: !!aestheticOnly,
    p_zone_slugs: safeZones.length ? safeZones : null,
    p_max_age: maxAge || "all-ages",
    p_limit: 3,
  });
  if (shortlistErr) return NextResponse.json({ error: "Couldn't build that poll" }, { status: 500 });
  if (!venues?.length) return NextResponse.json({ error: "Nothing matches that combo yet" }, { status: 400 });

  // Insert as the caller so RLS's is_group_member(group_id) check applies
  // a non-member can't spin up a poll in a group they don't belong to.
  const { data: poll, error } = await supabase
    .from("group_polls")
    .insert({
      group_id: id,
      created_by: user.id,
      selected_tag_slugs: safeTags,
      max_spend_aed: Number.isFinite(Number(maxSpend)) ? Math.max(0, Math.min(100000, Number(maxSpend))) : null,
      aesthetic_only: !!aestheticOnly,
      zone_slugs: safeZones.length ? safeZones : null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't create that group poll" }, { status: 500 });

  const { error: e2 } = await s.from("group_poll_options").insert(venues.map((v) => ({ poll_id: poll.id, venue_id: v.id })));
  if (e2) {
    await s.from("group_polls").delete().eq("id", poll.id);
    return NextResponse.json({ error: "Couldn't add choices to that poll" }, { status: 500 });
  }

  // A group has one current decision. Only archive older polls after the new
  // poll is fully usable, so a failed option insert cannot wipe out the old one.
  const now = new Date().toISOString();
  await s
    .from("group_polls")
    .update({ expires_at: now })
    .eq("group_id", id)
    .neq("id", poll.id)
    .gt("expires_at", now);

  return NextResponse.json({ id: poll.id });
}

