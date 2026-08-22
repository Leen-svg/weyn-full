import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers } from "@/lib/venueMedia";

export async function GET(_req, { params }) {
  const { code } = await params;
  const s = db();
  const { data: poll, error } = await s
    .from("polls")
    .select("id, short_code, expires_at, created_at")
    .eq("short_code", code)
    .single();
  if (error || !poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  const { data: options } = await s
    .from("poll_options")
    .select("id, venue_id, venues (id, name, neighborhood, city, latitude, longitude, avg_spend_aed, is_aesthetic, hero_video_url, google_maps_url)")
    .eq("poll_id", poll.id);

  const { data: votes } = await s
    .from("votes")
    .select("poll_option_id, voter_name, voter_fingerprint")
    .eq("poll_id", poll.id);
  const venuesWithMedia = await withCovers((options || []).map((option) => option.venues).filter(Boolean));
  const venueMap = Object.fromEntries(venuesWithMedia.map((venue) => [venue.id, venue]));

  return NextResponse.json({
    poll: { id: poll.id, code: poll.short_code, expiresAt: poll.expires_at, expired: new Date(poll.expires_at) < new Date() },
    options: (options || []).map((o) => ({
      optionId: o.id,
      venue: venueMap[o.venue_id] || o.venues,
      votes: (votes || []).filter((v) => v.poll_option_id === o.id).length,
      voters: (votes || []).filter((v) => v.poll_option_id === o.id).map((v) => v.voter_name).filter(Boolean),
    })),
    totalVotes: (votes || []).length,
  });
}

