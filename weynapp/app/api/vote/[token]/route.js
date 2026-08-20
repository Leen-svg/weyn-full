import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers } from "@/lib/venueMedia";

export async function GET(req, { params }) {
  const { token } = await params;
  const s = db();
  const { data: poll } = await s
    .from("group_polls")
    .select("id, group_id, created_at, expires_at, friend_groups (name)")
    .eq("share_token", token)
    .maybeSingle();
  if (!poll) return NextResponse.json({ error: "Vote link not found" }, { status: 404 });

  const { data: options } = await s.from("group_poll_options").select("id, venue_id").eq("poll_id", poll.id);
  const venueIds = (options || []).map((o) => o.venue_id);
  const { data: venues } = venueIds.length
    ? await s
        .from("venues")
        .select("id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description")
        .in("id", venueIds)
    : { data: [] };
  const venuesWithMedia = await withCovers(venues || []);
  const venueMap = Object.fromEntries(venuesWithMedia.map((v) => [v.id, v]));

  const [{ data: memberVotes }, { data: guestVotes }] = await Promise.all([
    s.from("group_poll_votes").select("option_id").eq("poll_id", poll.id),
    s.from("group_poll_guest_votes").select("option_id, voter_name").eq("poll_id", poll.id),
  ]);

  return NextResponse.json({
    groupName: poll.friend_groups?.name,
    expired: new Date(poll.expires_at) < new Date(),
    options: (options || []).map((o) => {
      const votes = (memberVotes || []).filter((v) => v.option_id === o.id).length + (guestVotes || []).filter((v) => v.option_id === o.id).length;
      return {
        optionId: o.id,
        venue: venueMap[o.venue_id],
        votes,
        voters: (guestVotes || []).filter((v) => v.option_id === o.id).map((v) => v.voter_name || "Guest"),
      };
    }),
  });
}

export async function POST(req, { params }) {
  const { token } = await params;
  const { optionId, name, fingerprint } = await req.json();
  if (!optionId || !fingerprint) return NextResponse.json({ error: "optionId and fingerprint required" }, { status: 400 });

  const s = db();
  const { data: poll } = await s.from("group_polls").select("id, expires_at").eq("share_token", token).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Vote link not found" }, { status: 404 });
  if (new Date(poll.expires_at) < new Date()) return NextResponse.json({ error: "Voting has closed" }, { status: 400 });

  const { data: option } = await s.from("group_poll_options").select("id").eq("id", optionId).eq("poll_id", poll.id).maybeSingle();
  if (!option) return NextResponse.json({ error: "Invalid option" }, { status: 400 });

  const { error } = await s
    .from("group_poll_guest_votes")
    .upsert(
      { poll_id: poll.id, option_id: optionId, fingerprint, voter_name: (name || "").trim().slice(0, 40) || null },
      { onConflict: "poll_id,fingerprint" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

