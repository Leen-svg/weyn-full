import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const s = db();

  let query = s.from("profiles").select("id, is_admin, is_banned, banned_reason, points_balance, created_at").order("created_at", { ascending: false }).limit(100);
  const { data: profiles, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (profiles || []).map((p) => p.id);
  const [{ data: pub }, { data: reviews }, { data: saves }] = await Promise.all([
    ids.length ? s.from("profile_public").select("id, display_name, avatar_url").in("id", ids) : { data: [] },
    ids.length ? s.from("reviews").select("user_id").in("user_id", ids) : { data: [] },
    ids.length ? s.from("saves").select("user_id").in("user_id", ids) : { data: [] },
  ]);
  const pubMap = Object.fromEntries((pub || []).map((p) => [p.id, p]));
  const reviewCount = {};
  for (const r of reviews || []) reviewCount[r.user_id] = (reviewCount[r.user_id] || 0) + 1;
  const saveCount = {};
  for (const sv of saves || []) saveCount[sv.user_id] = (saveCount[sv.user_id] || 0) + 1;

  let users = (profiles || []).map((p) => ({
    ...p,
    display_name: pubMap[p.id]?.display_name || null,
    avatar_url: pubMap[p.id]?.avatar_url || null,
    review_count: reviewCount[p.id] || 0,
    save_count: saveCount[p.id] || 0,
  }));
  if (q) users = users.filter((u) => (u.display_name || "").toLowerCase().includes(q.toLowerCase()));

  return NextResponse.json({ users });
}
