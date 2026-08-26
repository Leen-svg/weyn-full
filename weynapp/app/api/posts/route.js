import { createClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { contentAccountError, utcDayStart, validateCommunityText } from "@/lib/content-safety";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { isVisibility, normalizeVisibility } from "@/lib/visibility.mjs";
import { ownedPendingMedia, removeCommunityMediaRows } from "@/lib/community-media-server";

export async function GET(req) {
  const supabase = await createClient(req);
  const { searchParams } = new URL(req.url);
  const requestedScope = searchParams.get("scope");
  const scope = requestedScope === "friends" || requestedScope === "mine" ? requestedScope : "public";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((scope === "friends" || scope === "mine") && !user) return NextResponse.json({ error: "Log in to see those posts" }, { status: 401 });

  // RLS already enforces visibility (public posts to everyone, friends-only
  // posts only to accepted friends), these two queries just pick which
  // slice of what's visible to show for this toggle.
  let query = supabase
    .from("posts")
    .select("id, body, photo_url, visibility, created_at, user_id, venue_id, saved_list_id, venues (id, name, neighborhood), saved_lists (title, share_slug, tags)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (scope === "public") query = query.eq("visibility", "public");
  else if (scope === "friends") query = query.eq("visibility", "friends").neq("user_id", user.id);
  else query = query.eq("user_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = data || [];
  const authorIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profile_public").select("id, display_name, avatar_url, ghost_mode").in("id", authorIds).eq("ghost_mode", false)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));

  return NextResponse.json({ posts: posts.filter((post) => authorMap[post.user_id]).map((post) => ({ ...post, profile_public: authorMap[post.user_id] })) });
}

export async function POST(req) {
  const supabase = await createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to post" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });

  const { venueId, savedListId, body, visibility, photoUrl, mediaId } = await req.json();
  const checked = validateCommunityText(body, { required: true, maxLength: 500 });
  if ((!venueId && !savedListId) || checked.error) return NextResponse.json({ error: checked.error || "Choose a venue or list" }, { status: 400 });
  if (!isVisibility(visibility)) return NextResponse.json({ error: "Choose who can see this post" }, { status: 400 });
  if (savedListId) {
    const { data: list } = await supabase.from("saved_lists").select("id").eq("id", savedListId).maybeSingle();
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
  }
  if (photoUrl) return NextResponse.json({ error: "Upload photos through Weyn so they can be reviewed safely." }, { status: 400 });
  const vis = visibility;
  const pendingMedia = mediaId ? await ownedPendingMedia({ id: mediaId, userId: user.id, contextType: "post" }) : null;
  if (mediaId && !pendingMedia) return NextResponse.json({ error: "That photo is not available" }, { status: 400 });
  const { count } = await db().from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", utcDayStart());
  if ((count || 0) >= 5) {
    if (pendingMedia) await removeCommunityMediaRows([pendingMedia]);
    return NextResponse.json({ error: "You've reached today's posting limit." }, { status: 429 });
  }

  const { data: post, error } = await supabase.from("posts").insert({
    user_id: user.id,
    venue_id: venueId || null,
    saved_list_id: savedListId || null,
    body: checked.text,
    photo_url: null,
    visibility: vis,
  }).select("id").single();
  if (error) {
    if (pendingMedia) await removeCommunityMediaRows([pendingMedia]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (pendingMedia) await db().from("community_media").update({ context_id: post.id, venue_id: venueId || null, visibility: vis }).eq("id", pendingMedia.id).eq("user_id", user.id);

  await awardPoints(user.id, POINTS.posted, "posted");
  return NextResponse.json({ ok: true, id: post.id, photoStatus: pendingMedia ? "pending" : null, pointsEarned: POINTS.posted });
}

export async function PATCH(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const payload = await req.json();
  const id = String(payload.id || "");
  const { data: post } = await supabase.from("posts").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const update = {};
  if (payload.action === "archive") update.archived_at = new Date().toISOString();
  else if (payload.action === "restore") update.archived_at = null;
  else if (payload.action === "visibility") update.visibility = normalizeVisibility(payload.visibility);
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const { error } = await supabase.from("posts").update(update).eq("id", id).eq("user_id", user.id);
  if (!error && update.visibility) await db().from("community_media").update({ visibility: update.visibility }).eq("context_type", "post").eq("context_id", id).eq("user_id", user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const { id } = await req.json();
  const service = db();
  const { data: post } = await service.from("posts").select("id,user_id").eq("id", id).maybeSingle();
  if (!post || post.user_id !== user.id) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const { data: media } = await service.from("community_media").select("id,storage_path,public_path").eq("context_type", "post").eq("context_id", id).eq("user_id", user.id);
  const { error } = await service.from("posts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await removeCommunityMediaRows(media);
  return NextResponse.json({ ok: true });
}
