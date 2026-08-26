import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const s = db();

  const [subs, votes, videos, takedowns, venues, reports, media] = await Promise.all([
    s.from("venue_submissions").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    s.from("tag_votes").select("*, venues (name)").eq("status", "new").order("created_at", { ascending: false }),
    s.from("video_submissions").select("*, venues (name)").in("status", ["pending", "takedown_requested"]).order("created_at", { ascending: false }),
    s.from("takedown_requests").select("*").eq("status", "pending").order("created_at", { ascending: false }),
    s.from("venues").select("id", { count: "exact", head: true }),
    s.from("content_reports").select("*").eq("status", "open").order("created_at", { ascending: false }),
    s.from("community_media").select("id,user_id,context_type,context_id,venue_id,storage_path,mime_type,byte_size,visibility,created_at,venues(name)").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
  ]);

  const pendingMedia = await Promise.all((media.data || []).map(async (item) => {
    const { data: signed } = await s.storage.from("community-media-quarantine").createSignedUrl(item.storage_path, 300);
    return { ...item, preview_url: signed?.signedUrl || null };
  }));

  // Disputed venues: group non-"fits" votes by venue
  const disputes = {};
  for (const v of votes.data || []) {
    const key = v.venue_id;
    disputes[key] = disputes[key] || { venue_id: key, name: v.venues?.name, fits: 0, issues: [] };
    if (v.vote === "fits") disputes[key].fits++;
    else disputes[key].issues.push(v);
  }

  const reportGroups = new Map();
  for (const report of reports.data || []) {
    const key = report.content_type + ":" + report.content_id;
    const current = reportGroups.get(key) || {
      key, contentType: report.content_type, contentId: report.content_id,
      count: 0, reasons: [], firstReportedAt: report.created_at,
    };
    current.count += 1;
    current.reasons.push(report.reason);
    reportGroups.set(key, current);
  }
  const postIds = [...reportGroups.values()].filter((g) => g.contentType === "post").map((g) => g.contentId);
  const reviewIds = [...reportGroups.values()].filter((g) => g.contentType === "review").map((g) => g.contentId);
  const [{ data: reportedPosts }, { data: reportedReviews }] = await Promise.all([
    postIds.length ? s.from("posts").select("id,body,photo_url,status,user_id,venues(name)").in("id", postIds) : { data: [] },
    reviewIds.length ? s.from("reviews").select("id,body,photo_url,status,user_id,rating,venues(name)").in("id", reviewIds) : { data: [] },
  ]);
  const contentMap = new Map([
    ...(reportedPosts || []).map((item) => ["post:" + item.id, item]),
    ...(reportedReviews || []).map((item) => ["review:" + item.id, item]),
  ]);
  const contentReports = [...reportGroups.values()]
    .map((group) => ({ ...group, content: contentMap.get(group.key) || null }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    submissions: subs.data || [],
    tagVotes: votes.data || [],
    disputes: Object.values(disputes).sort((a, b) => b.issues.length - a.issues.length),
    videos: videos.data || [],
    takedowns: takedowns.data || [],
    contentReports,
    pendingMedia,
    venueCount: venues.count || 0,
  });
}

