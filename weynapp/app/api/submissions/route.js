import { db } from "@/lib/db";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req) {
  const body = await req.json();
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Place name is required" }, { status: 400 });
  if (!body.zone_slug) return NextResponse.json({ error: "Pick a zone" }, { status: 400 });

  const s = db();

  // soft duplicate check against live venues and pending submissions
  const { data: existing } = await s.from("venues").select("id").ilike("name", name).limit(1);
  if (existing && existing.length) {
    return NextResponse.json({ error: "Good taste, that one's already on Weyn 🙌" }, { status: 409 });
  }
  const { data: pending } = await s.from("venue_submissions").select("id").ilike("name", name).eq("status", "pending").limit(1);
  if (pending && pending.length) {
    return NextResponse.json({ error: "Someone just submitted that one, it's in the review queue." }, { status: 409 });
  }

  const t = body.tagsByCategory || {};
  const flat = (k) => t[k] || [];

  let userId = null;
  try {
    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    userId = user?.id || null;
  } catch {
    // anonymous submissions stay fully supported
  }

  const { error } = await s.from("venue_submissions").insert({
    name,
    zone_slug: body.zone_slug,
    neighborhood: (body.neighborhood || "").trim() || null,
    google_maps_url: (body.google_maps_url || "").trim() || null,
    why_love: (body.why_love || "").trim() || null,
    energy_tag: flat("mood")[0] || flat("energy")[0] || null,
    activity_tags: flat("move").length ? flat("move") : flat("activity"),
    occasion_tags: flat("moment").length ? flat("moment") : flat("occasion"),
    avg_spend_aed: body.avg_spend_aed ? parseInt(body.avg_spend_aed, 10) : null,
    submitter_name: (body.submitter_name || "").trim() || null,
    submitter_handle: (body.submitter_handle || "").trim() || null,
    user_id: userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pointsEarned: 0, pendingReview: true });
}

