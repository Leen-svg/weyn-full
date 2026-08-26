import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { canViewVisibility } from "@/lib/visibility.mjs";

async function viewer(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  const service = db();
  const { data: friendships } = user ? await service.from("friendships").select("requester_id,addressee_id").eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`) : { data: [] };
  const friendIds = new Set((friendships || []).map((row) => row.requester_id === user.id ? row.addressee_id : row.requester_id));
  return { user, service, friendIds };
}

function visibleTo({ item, user, friendIds, scope }) {
  const isFriend = friendIds.has(item.user_id);
  if (!canViewVisibility({ viewerId: user?.id, ownerId: item.user_id, visibility: item.visibility, isFriend })) return false;
  if (scope === "public") return item.visibility === "public";
  if (scope === "friends") return item.visibility === "friends" && isFriend;
  return item.visibility === "public" || (item.visibility === "friends" && isFriend);
}

export async function GET(req) {
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") || "").trim().toLocaleLowerCase().slice(0, 80);
  const scope = url.searchParams.get("scope") === "friends" ? "friends" : url.searchParams.get("scope") === "all" ? "all" : "public";
  const { user, service, friendIds } = await viewer(req);
  if (scope === "friends" && !user) return NextResponse.json({ error: "Log in to search friends' collections" }, { status: 401 });
  const [{ data: lists }, { data: tags }] = await Promise.all([
    service.from("saved_lists").select("id,user_id,title,description,tags,visibility,share_slug,updated_at,saved_list_items(venue_id)").is("archived_at", null).in("visibility", scope === "public" ? ["public"] : ["public", "friends"]).order("updated_at", { ascending: false }).limit(200),
    service.from("user_tags").select("id,user_id,name,description,visibility,share_slug,updated_at,user_tag_venues(venue_id)").is("archived_at", null).in("visibility", scope === "public" ? ["public"] : ["public", "friends"]).order("updated_at", { ascending: false }).limit(200),
  ]);
  const candidateOwners = [...new Set([...(lists || []), ...(tags || [])].map((item) => item.user_id))];
  const { data: profiles } = candidateOwners.length ? await service.from("profile_public").select("id,display_name,avatar_url,ghost_mode").in("id", candidateOwners).eq("ghost_mode", false) : { data: [] };
  const authors = new Map((profiles || []).map((profile) => [profile.id, profile]));
  const match = (...values) => !q || values.some((value) => String(value || "").toLocaleLowerCase().includes(q));
  const visibleLists = (lists || []).filter((item) => authors.has(item.user_id) && visibleTo({ item, user, friendIds, scope }) && match(item.title, item.description, ...(item.tags || []))).slice(0, 40).map((item) => ({ ...item, author: authors.get(item.user_id), place_count: item.saved_list_items?.length || 0 }));
  const visibleTags = (tags || []).filter((item) => authors.has(item.user_id) && visibleTo({ item, user, friendIds, scope }) && match(item.name, item.description)).slice(0, 40).map((item) => ({ ...item, author: authors.get(item.user_id), place_count: item.user_tag_venues?.length || 0 }));
  return NextResponse.json({ lists: visibleLists, tags: visibleTags });
}

export async function POST(req) {
  const { user, service, friendIds } = await viewer(req);
  if (!user) return NextResponse.json({ error: "Log in to save a community collection" }, { status: 401 });
  const body = await req.json();
  const type = body.type === "tag" ? "tag" : "list";
  const table = type === "tag" ? "user_tags" : "saved_lists";
  const targetColumn = type === "tag" ? "tag_id" : "list_id";
  const bookmarkTable = type === "tag" ? "user_tag_bookmarks" : "saved_list_bookmarks";
  const { data: item } = await service.from(table).select("id,user_id,visibility,archived_at").eq("id", body.id).maybeSingle();
  if (!item || item.archived_at || !canViewVisibility({ viewerId: user.id, ownerId: item.user_id, visibility: item.visibility, isFriend: friendIds.has(item.user_id) })) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  if (item.user_id === user.id) return NextResponse.json({ error: "This is already yours" }, { status: 400 });
  const { error } = await service.from(bookmarkTable).upsert({ user_id: user.id, [targetColumn]: item.id });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { user, service } = await viewer(req);
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const body = await req.json();
  const type = body.type === "tag" ? "tag" : "list";
  const targetColumn = type === "tag" ? "tag_id" : "list_id";
  const bookmarkTable = type === "tag" ? "user_tag_bookmarks" : "saved_list_bookmarks";
  const { error } = await service.from(bookmarkTable).delete().eq("user_id", user.id).eq(targetColumn, body.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}

