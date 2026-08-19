import { db } from "@/lib/db";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";

const VALID = ["fits", "wrong_tag", "missing_tag"];

export async function POST(req) {
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
    tag_slug: b.tag_slug || null,
    suggested_tag_slug: b.suggested_tag_slug || null,
    comment: (b.comment || "").slice(0, 300) || null,
    voter_fingerprint: b.fingerprint,
    user_id: userId,
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "You already sent that one 🙂" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let pointsEarned = 0;
  if (userId && b.vote !== "fits") {
    pointsEarned = POINTS.suggested_a_tag_fix;
    await awardPoints(userId, pointsEarned, "suggested_a_tag_fix");
  }
  return NextResponse.json({ ok: true, pointsEarned });
}
