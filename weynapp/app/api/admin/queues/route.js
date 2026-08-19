import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const s = db();

  const [subs, votes, videos, takedowns, venues] = await Promise.all([
    s.from("venue_submissions").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    s.from("tag_votes").select("*, venues (name)").eq("status", "new").order("created_at", { ascending: false }),
    s.from("video_submissions").select("*, venues (name)").in("status", ["pending", "takedown_requested"]).order("created_at", { ascending: false }),
    s.from("takedown_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    s.from("venues").select("id", { count: "exact", head: true }),
  ]);

  // Disputed venues: group non-"fits" votes by venue
  const disputes = {};
  for (const v of votes.data || []) {
    const key = v.venue_id;
    disputes[key] = disputes[key] || { venue_id: key, name: v.venues?.name, fits: 0, issues: [] };
    if (v.vote === "fits") disputes[key].fits++;
    else disputes[key].issues.push(v);
  }

  return NextResponse.json({
    submissions: subs.data || [],
    tagVotes: votes.data || [],
    disputes: Object.values(disputes).sort((a, b) => b.issues.length - a.issues.length),
    videos: videos.data || [],
    takedowns: takedowns.data || [],
    venueCount: venues.count || 0,
  });
}
