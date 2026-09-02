import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

function dateKey(value) { return new Date(value).toISOString().slice(0, 10); }
function uniqueUsers(rows) { return new Set((rows || []).map((row) => row.user_id).filter(Boolean)); }

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const service = db();
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const since14 = new Date(now.getTime() - 13 * 86400000);
  since14.setUTCHours(0, 0, 0, 0);

  const [profilesResult, userCountResult, savesResult, reviewsResult, checkInsResult] = await Promise.all([
    service.from("profiles").select("id,created_at").gte("created_at", new Date(now.getTime() - 90 * 86400000).toISOString()).order("created_at"),
    service.from("profiles").select("id", { count: "exact", head: true }),
    service.from("saves").select("user_id,venue_id,created_at,venues(name)").gte("created_at", since30).limit(10000),
    service.from("reviews").select("user_id,venue_id,created_at,venues(name)").gte("created_at", since30).limit(10000),
    service.from("check_ins").select("user_id,venue_id,created_at,venues(name)").gte("created_at", since30).limit(10000),
  ]);
  const firstError = [profilesResult, userCountResult, savesResult, reviewsResult, checkInsResult].find((result) => result.error)?.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const profiles = profilesResult.data || [];
  const saves = savesResult.data || [];
  const reviews = reviewsResult.data || [];
  const checkIns = checkInsResult.data || [];
  const cutoff = (days) => now.getTime() - days * 86400000;
  const daily = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(since14.getTime() + index * 86400000).toISOString().slice(0, 10);
    return { date, signups: profiles.filter((profile) => dateKey(profile.created_at) === date).length };
  });
  const active = new Set([...uniqueUsers(saves), ...uniqueUsers(reviews), ...uniqueUsers(checkIns)]);
  const venueCounts = new Map();
  for (const row of [...saves, ...reviews, ...checkIns]) {
    const name = row.venues?.name || "Unknown venue";
    venueCounts.set(name, (venueCounts.get(name) || 0) + 1);
  }

  return NextResponse.json({
    metrics: {
      totalUsers: userCountResult.count || 0,
      newToday: profiles.filter((profile) => new Date(profile.created_at).getTime() >= cutoff(1)).length,
      new7Days: profiles.filter((profile) => new Date(profile.created_at).getTime() >= cutoff(7)).length,
      new30Days: profiles.filter((profile) => new Date(profile.created_at).getTime() >= cutoff(30)).length,
      active30Days: active.size,
      saves30Days: saves.length,
      reviews30Days: reviews.length,
      checkIns30Days: checkIns.length,
    },
    daily,
    topVenues: [...venueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, interactions]) => ({ name, interactions })),
    vercelAnalyticsUrl: "https://vercel.com/weyn/weyn-full/analytics",
  });
}
