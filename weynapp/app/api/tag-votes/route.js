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



/* Retract a tag vote.

   Votes could be cast but never taken back, so a mistaken "wrong tag" was
   permanent from the user's side. Only the voter's own row is removed: signed
   in, that means their user_id; anonymous, the browser fingerprint that cast
   it. Points awarded for the original suggestion are deliberately left alone
   rather than clawed back. */
export async function DELETE(req) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const body = await req.json().catch(() => ({}));
  const venueId = String(body.venue_id || "");
  if (!venueId) return NextResponse.json({ error: "venue_id required" }, { status: 400 });

  let userId = null;
  try {
    const sessionClient = await createServerClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    userId = user?.id || null;
  } catch {
    // anonymous voters retract by fingerprint
  }

  const fingerprint = String(body.fingerprint || "");
  if (!userId && !fingerprint) {
    return NextResponse.json({ error: "Can't identify that vote" }, { status: 400 });
  }

  let query = db().from("tag_votes").delete().eq("venue_id", venueId);
  query = userId ? query.eq("user_id", userId) : query.eq("voter_fingerprint", fingerprint);
  if (body.tag_slug) query = query.eq("tag_slug", String(body.tag_slug).slice(0, 80));

  const { error } = await query;
  if (error) return NextResponse.json({ error: "Couldn't undo that vote" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
