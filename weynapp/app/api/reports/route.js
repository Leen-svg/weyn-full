import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { contentAccountError, utcDayStart } from "@/lib/content-safety";
import { NextResponse } from "next/server";

const TYPES = { post: "posts", review: "reviews" };
const REASONS = new Set(["inappropriate", "spam", "harassment", "other"]);

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: user ? 403 : 401 });

  const { contentType, contentId, reason } = await req.json();
  const table = TYPES[contentType];
  if (!table || !contentId || !REASONS.has(reason)) {
    return NextResponse.json({ error: "Choose a valid report reason." }, { status: 400 });
  }

  const s = db();
  const { count: dailyCount } = await s.from("content_reports").select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id).gte("created_at", utcDayStart());
  if ((dailyCount || 0) >= 5) return NextResponse.json({ error: "You've reached today's report limit." }, { status: 429 });

  const { data: content } = await s.from(table).select("id,user_id,status").eq("id", contentId).maybeSingle();
  if (!content || content.status === "removed") return NextResponse.json({ error: "That content is no longer available." }, { status: 404 });
  if (content.user_id === user.id) return NextResponse.json({ error: "You can't report your own content." }, { status: 400 });

  const { error } = await s.from("content_reports").insert({
    reporter_id: user.id, content_type: contentType, content_id: contentId, reason,
  });
  if (error?.code === "23505") return NextResponse.json({ error: "You've already reported this." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Couldn't send that report." }, { status: 500 });

  const { count } = await s.from("content_reports").select("id", { count: "exact", head: true })
    .eq("content_type", contentType).eq("content_id", contentId).eq("status", "open");
  const hidden = (count || 0) >= 3;
  if (hidden) await s.from(table).update({ status: "hidden" }).eq("id", contentId).eq("status", "published");
  return NextResponse.json({ ok: true, hidden });
}

