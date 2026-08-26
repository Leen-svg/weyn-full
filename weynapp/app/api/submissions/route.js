import { db } from "@/lib/db";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";
import { validateCommunityText } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

function safeHttpUrl(value) {
  if (!value) return null;
  try { const url = new URL(String(value).trim()); return ["https:", "http:"].includes(url.protocol) ? url.href.slice(0, 500) : null; } catch { return null; }
}

export async function POST(req) {
  if (payloadTooLarge(req, 32 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "venue-submission", 5, 24 * 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "You've reached today's submission limit." }, { status: 429 });
  const body = await req.json();
  const name = String(body.name || "").trim().slice(0, 120);
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
  const flat = (k) => Array.isArray(t[k]) ? [...new Set(t[k].map(String))].slice(0, 12) : [];
  const why = validateCommunityText(body.why_love, { maxLength: 500 });
  if (why.error) return NextResponse.json({ error: why.error }, { status: 400 });

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
    zone_slug: String(body.zone_slug).trim().slice(0, 80),
    neighborhood: String(body.neighborhood || "").trim().slice(0, 120) || null,
    google_maps_url: safeHttpUrl(body.google_maps_url),
    why_love: why.text,
    energy_tag: flat("mood")[0] || flat("energy")[0] || null,
    activity_tags: flat("move").length ? flat("move") : flat("activity"),
    occasion_tags: flat("moment").length ? flat("moment") : flat("occasion"),
    avg_spend_aed: body.avg_spend_aed ? parseInt(body.avg_spend_aed, 10) : null,
    submitter_name: String(body.submitter_name || "").trim().slice(0, 80) || null,
    submitter_handle: String(body.submitter_handle || "").trim().slice(0, 80) || null,
    user_id: userId,
  });
  if (error) return NextResponse.json({ error: "Couldn't submit that place" }, { status: 500 });
  if (userId) await awardPoints(userId, POINTS.suggested_a_place, "suggested_a_place");
  return NextResponse.json({ ok: true, pointsEarned: userId ? POINTS.suggested_a_place : 0 });
}


