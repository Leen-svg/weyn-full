import { db } from "@/lib/db";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

const VALID = ["fits", "wrong_tag", "missing_tag"];

export async function POST(req) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "tag-vote", 30, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many votes. Try again later." }, { status: 429 });
  const b = await req.json();
  if (!b.venue_id || !VALID.includes(b.vote) || !b.fingerprint) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  let userId = null;
  try {
    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    userId = user?.id || null;
  } catch {
    // anonymous tag votes stay fully supported
  }

  const { error } = await db().from("tag_votes").insert({
    venue_id: b.venue_id,
    vote: b.vote,
    tag_slug: String(b.tag_slug || "").slice(0, 80) || null,
    suggested_tag_slug: String(b.suggested_tag_slug || "").slice(0, 80) || null,
    comment: (b.comment || "").slice(0, 300) || null,
    voter_fingerprint: b.fingerprint,
    user_id: userId,
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already sent that one 🙂" }, { status: 409 });
    return NextResponse.json({ error: "Couldn't save that vote" }, { status: 500 });
  }

  let pointsEarned = 0;
  if (userId && b.vote !== "fits") {
    pointsEarned = POINTS.suggested_a_tag_fix;
    await awardPoints(userId, pointsEarned, "suggested_a_tag_fix");
  }
  return NextResponse.json({ ok: true, pointsEarned });
}


