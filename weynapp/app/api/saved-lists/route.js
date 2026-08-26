import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { isVisibility, normalizeVisibility } from "@/lib/visibility.mjs";

const cleanTags = (tags) => [...new Set((Array.isArray(tags) ? tags : []).map((tag) => String(tag).trim().slice(0, 24)).filter(Boolean))].slice(0, 12);
const cleanIds = (ids) => [...new Set((Array.isArray(ids) ? ids : []).map(String))].slice(0, 100);

async function currentUser(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(req) {
  const { supabase, user } = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Log in to see your lists" }, { status: 401 });
  const { data, error } = await supabase
    .from("saved_lists")
    .select("id, title, description, tags, visibility, share_slug, archived_at, created_at, saved_list_items(venue_id)")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const s = db();
  const [{ data: direct }, { data: memberships }, { data: archived }, { data: bookmarks }, { data: friendships }] = await Promise.all([
    s.from("saved_list_friend_shares").select("list_id").eq("friend_id", user.id),
    s.from("friend_group_members").select("group_id").eq("user_id", user.id),
    s.from("saved_lists").select("id,title,description,tags,visibility,share_slug,archived_at,saved_list_items(venue_id)").eq("user_id", user.id).not("archived_at", "is", null).order("archived_at", { ascending: false }),
    s.from("saved_list_bookmarks").select("list_id").eq("user_id", user.id),
    s.from("friendships").select("requester_id,addressee_id").eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
  ]);
  const groupIds = (memberships || []).map((row) => row.group_id);
  const { data: groupShares } = groupIds.length
    ? await s.from("saved_list_group_shares").select("list_id").in("group_id", groupIds)
    : { data: [] };
  const sharedIds = [...new Set([...(direct || []), ...(groupShares || [])].map((row) => row.list_id))];
  const { data: shared } = sharedIds.length
    ? await s.from("saved_lists").select("id, title, description, tags, visibility, share_slug, user_id, archived_at, saved_list_items(venue_id)").in("id", sharedIds).neq("user_id", user.id).is("archived_at", null)
    : { data: [] };
  const friendIds = new Set((friendships || []).map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id));
  const bookmarkIds = (bookmarks || []).map((row) => row.list_id);
  const { data: bookmarkedRows } = bookmarkIds.length
    ? await s.from("saved_lists").select("id,title,description,tags,visibility,share_slug,user_id,archived_at,saved_list_items(venue_id)").in("id", bookmarkIds).is("archived_at", null)
    : { data: [] };
  const bookmarked = (bookmarkedRows || []).filter((list) => list.visibility === "public" || (list.visibility === "friends" && friendIds.has(list.user_id)));
  return NextResponse.json({ lists: data || [], archived: archived || [], sharedWithMe: shared || [], bookmarked });
}

export async function POST(req) {
  if (payloadTooLarge(req, 24 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { supabase, user } = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Log in to create a list" }, { status: 401 });
  const body = await req.json();
  const title = String(body.title || "").trim().slice(0, 80);
  const description = String(body.description || "").trim().slice(0, 240);
  const venueIds = cleanIds(body.venueIds);
  if (!title) return NextResponse.json({ error: "Give your list a name" }, { status: 400 });
  if (!isVisibility(body.visibility)) return NextResponse.json({ error: "Choose who can see this list" }, { status: 400 });
  const { data: list, error } = await supabase.from("saved_lists").insert({ user_id: user.id, title, description, tags: cleanTags(body.tags), visibility: body.visibility }).select("id, share_slug, visibility").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (venueIds.length) {
    const { data: owned } = await supabase.from("saves").select("venue_id").in("venue_id", venueIds);
    const allowed = new Set((owned || []).map((row) => row.venue_id));
    await supabase.from("saved_list_items").insert(venueIds.filter((id) => allowed.has(id)).map((venue_id) => ({ list_id: list.id, venue_id })));
  }
  return NextResponse.json({ ok: true, list });
}

export async function PATCH(req) {
  if (payloadTooLarge(req, 24 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { supabase, user } = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const body = await req.json();
  const id = String(body.id || "");
  const { data: list } = await supabase.from("saved_lists").select("id, title, share_slug").eq("id", id).maybeSingle();
  if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });

  if (body.action === "archive" || body.action === "restore") {
    const { error } = await supabase.from("saved_lists").update({ archived_at: body.action === "archive" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }

  if (body.action === "update") {
    const title = String(body.title || "").trim().slice(0, 80);
    if (!title) return NextResponse.json({ error: "Give your list a name" }, { status: 400 });
    if (!isVisibility(body.visibility)) return NextResponse.json({ error: "Choose who can see this list" }, { status: 400 });
    const venueIds = cleanIds(body.venueIds);
    const visibility = body.visibility;
    const { error } = await supabase.from("saved_lists").update({ title, description: String(body.description || "").trim().slice(0, 240), tags: cleanTags(body.tags), visibility, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data: owned } = venueIds.length ? await supabase.from("saves").select("venue_id").in("venue_id", venueIds) : { data: [] };
    const allowed = new Set((owned || []).map((row) => row.venue_id));
    await supabase.from("saved_list_items").delete().eq("list_id", id);
    const rows = venueIds.filter((venueId) => allowed.has(venueId)).map((venue_id) => ({ list_id: id, venue_id }));
    if (rows.length) await supabase.from("saved_list_items").insert(rows);
    return NextResponse.json({ ok: true });
  }

  const shareUrl = `/lists/${list.share_slug}`;
  if (body.action === "share-group") {
    const groupId = String(body.targetId || "");
    const { data: membership } = await supabase.from("friend_group_members").select("group_id").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "You are not a member of that group" }, { status: 403 });
    await db().from("saved_list_group_shares").upsert({ list_id: id, group_id: groupId, shared_by: user.id });
    await db().from("group_messages").insert({ group_id: groupId, user_id: user.id, body: `📚 ${list.title}`, share_type: "saved_list", share_id: id });
    return NextResponse.json({ ok: true, shareUrl });
  }
  if (body.action === "share-friend") {
    const friendId = String(body.targetId || "");
    const { data: friendship } = await supabase.from("friendships").select("id").eq("status", "accepted").or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`).maybeSingle();
    if (!friendship) return NextResponse.json({ error: "You can only share with accepted friends" }, { status: 403 });
    await db().from("saved_list_friend_shares").upsert({ list_id: id, friend_id: friendId, shared_by: user.id });
    return NextResponse.json({ ok: true, shareUrl });
  }
  if (body.action === "share-post") {
    const visibility = normalizeVisibility(body.visibility);
    await supabase.from("saved_lists").update({ visibility, updated_at: new Date().toISOString() }).eq("id", id);
    const postBody = String(body.postBody || `A list worth saving: ${list.title}`).trim().slice(0, 500);
    const { error } = await supabase.from("posts").insert({ user_id: user.id, venue_id: null, saved_list_id: id, body: postBody, visibility, photo_url: null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, shareUrl });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req) {
  const { supabase, user } = await currentUser(req);
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabase.from("saved_lists").delete().eq("id", id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
