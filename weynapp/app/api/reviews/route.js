import { createClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { db } from "@/lib/db";
import { contentAccountError, utcDayStart, validateCommunityText } from "@/lib/content-safety";
import { NextResponse } from "next/server";
import { isVisibility, normalizeVisibility } from "@/lib/visibility.mjs";
import { ownedPendingMedia, removeCommunityMediaRows } from "@/lib/community-media-server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venue_id");
  if (!venueId) return NextResponse.json({ error: "venue_id required" }, { status: 400 });

  const supabase = await createClient(req);
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, photo_url, visibility, aesthetic_taste, quiet_loud, wallet_splurge, created_at, user_id")
    .eq("venue_id", venueId)
    .eq("status", "published")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reviews = data || [];
  const authorIds = [...new Set(reviews.map((r) => r.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profile_public").select("id, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));

  return NextResponse.json({ reviews: reviews.map((r) => ({ ...r, profile_public: authorMap[r.user_id] || null })) });
}

export async function POST(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to leave a review" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });

  const { venueId, rating, body, photoUrl, mediaId, visibility, aestheticTaste, quietLoud, walletSplurge } = await req.json();
  const r = Number(rating);
  if (!venueId || !Number.isInteger(r) || r < 1 || r > 5) {
    return NextResponse.json({ error: "A venue and a 1-5 rating are required" }, { status: 400 });
  }
  if (!isVisibility(visibility)) return NextResponse.json({ error: "Choose who can see this review" }, { status: 400 });
  const checked = validateCommunityText(body, { maxLength: 1000 });
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (photoUrl) return NextResponse.json({ error: "Upload photos through Weyn so they can be reviewed safely." }, { status: 400 });
  const vis = visibility;
  const optionalMetric = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : NaN;
  };
  const quiet = optionalMetric(quietLoud);
  const wallet = optionalMetric(walletSplurge);
  const legacyTaste = optionalMetric(aestheticTaste);
  if ([quiet, wallet, legacyTaste].some(Number.isNaN)) return NextResponse.json({ error: "Vibe values must be between 0 and 100" }, { status: 400 });
  const pendingMedia = mediaId ? await ownedPendingMedia({ id: mediaId, userId: user.id, contextType: "review" }) : null;
  if (mediaId && !pendingMedia) return NextResponse.json({ error: "That photo is not available" }, { status: 400 });

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();

  if (!existing) {
    const { count } = await db().from("reviews").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", utcDayStart());
    if ((count || 0) >= 10) {
      if (pendingMedia) await removeCommunityMediaRows([pendingMedia]);
      return NextResponse.json({ error: "You've reached today's rating limit." }, { status: 429 });
    }
  }

  const { data: review, error } = await supabase.from("reviews").upsert(
    { user_id: user.id, venue_id: venueId, rating: r, body: checked.text, photo_url: null, status: "published", visibility: vis, archived_at: null, aesthetic_taste: legacyTaste ?? Math.round((r - 1) * 25), quiet_loud: quiet, wallet_splurge: wallet },
    { onConflict: "user_id,venue_id" }
  ).select("id").single();
  if (error) {
    if (pendingMedia) await removeCommunityMediaRows([pendingMedia]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (pendingMedia) {
    const service = db();
    const { data: oldMedia } = await service.from("community_media").select("id,storage_path,public_path").eq("context_type", "review").eq("context_id", review.id).neq("id", pendingMedia.id);
    await removeCommunityMediaRows(oldMedia);
    await service.from("community_media").update({ context_id: review.id, venue_id: venueId, visibility: vis }).eq("id", pendingMedia.id).eq("user_id", user.id);
  }

  let pointsEarned = 0;
  if (!existing) {
    pointsEarned = POINTS.rated_a_place;
    await awardPoints(user.id, POINTS.rated_a_place, "rated_a_place");
  }
  return NextResponse.json({ ok: true, id: review.id, photoStatus: pendingMedia ? "pending" : null, pointsEarned });
}

export async function PATCH(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const payload = await req.json();
  const id = String(payload.id || "");
  const { data: review } = await supabase.from("reviews").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  const update = {};
  if (payload.action === "archive") update.archived_at = new Date().toISOString();
  else if (payload.action === "restore") update.archived_at = null;
  else if (payload.action === "visibility") update.visibility = normalizeVisibility(payload.visibility);
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const { error } = await supabase.from("reviews").update(update).eq("id", id).eq("user_id", user.id);
  if (!error && update.visibility) await db().from("community_media").update({ visibility: update.visibility }).eq("context_type", "review").eq("context_id", id).eq("user_id", user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const { id } = await req.json();
  const service = db();
  const { data: review } = await service.from("reviews").select("id,user_id").eq("id", id).maybeSingle();
  if (!review || review.user_id !== user.id) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  const { data: media } = await service.from("community_media").select("id,storage_path,public_path").eq("context_type", "review").eq("context_id", id).eq("user_id", user.id);
  const { error } = await service.from("reviews").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await removeCommunityMediaRows(media);
  return NextResponse.json({ ok: true });
}
