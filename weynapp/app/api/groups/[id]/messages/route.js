import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { notifyMany } from "@/lib/notify";
import { NextResponse } from "next/server";
import { contentAccountError, validateCommunityText } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { normalizeStructuredShare } from "@/lib/structured-share.mjs";

export async function GET(req, { params }) {
  const { id } = await params;
  const supabase = await createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  // RLS enforces group membership, an empty result here can also mean "not a member".
  const { data, error } = await supabase
    .from("group_messages")
    .select("id, body, user_id, created_at, share_type, share_id")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Couldn't load messages" }, { status: 500 });

  const messages = (data || []).reverse();
  const authorIds = [...new Set(messages.map((m) => m.user_id))];
  const s = db();
  const { data: authors } = authorIds.length
    ? await s.from("profile_public").select("id, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));

  const venueIds = [...new Set(messages.filter((m) => m.share_type === "venue" && m.share_id).map((m) => m.share_id))];
  const listIds = [...new Set(messages.filter((m) => m.share_type === "saved_list" && m.share_id).map((m) => m.share_id))];
  const boardIds = [...new Set(messages.filter((m) => m.share_type === "trip_board" && m.share_id).map((m) => m.share_id))];
  const pollIds = [...new Set(messages.filter((m) => m.share_type === "poll" && m.share_id).map((m) => m.share_id))];
  const [{ data: venues }, { data: lists }, { data: boards }, { data: polls }] = await Promise.all([
    venueIds.length ? s.from("venues").select("id,name,neighborhood,city").in("id", venueIds) : { data: [] },
    listIds.length ? s.from("saved_lists").select("id,title,share_slug").in("id", listIds) : { data: [] },
    boardIds.length ? s.from("trip_boards").select("id,title,share_slug").in("id", boardIds) : { data: [] },
    pollIds.length ? s.from("polls").select("id,short_code").in("id", pollIds) : { data: [] },
  ]);
  const shares = new Map([
    ...(venues || []).map((item) => [`venue:${item.id}`, { type: "venue", id: item.id, title: item.name, subtitle: item.neighborhood || item.city || "UAE", href: `/app?venue=${item.id}` }]),
    ...(lists || []).map((item) => [`saved_list:${item.id}`, { type: "saved_list", id: item.id, title: item.title, subtitle: "Saved list", href: `/lists/${item.share_slug}` }]),
    ...(boards || []).map((item) => [`trip_board:${item.id}`, { type: "trip_board", id: item.id, title: item.title, subtitle: "Plan board", href: `/b/${item.share_slug}` }]),
    ...(polls || []).map((item) => [`poll:${item.id}`, { type: "poll", id: item.id, title: "Vote on where to go", subtitle: "Weyn group vote", href: `/p/${item.short_code}` }]),
  ]);

  return NextResponse.json({ messages: messages.map((m) => ({
    ...m,
    profile_public: authorMap[m.user_id] || null,
    structured_share: m.share_type && m.share_id ? shares.get(`${m.share_type}:${m.share_id}`) || null : null,
  })) });
}

export async function POST(req, { params }) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { id } = await params;
  const supabase = await createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });
  const limited = await rateLimit(req, "group-message", 100, 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "You're sending messages too quickly." }, { status: 429 });

  const payload = await req.json();
  const share = normalizeStructuredShare(payload.share);
  if (payload.share && !share) return NextResponse.json({ error: "That Weyn share is invalid" }, { status: 400 });
  const checked = validateCommunityText(payload.body, { required: !share, maxLength: 1000 });
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });

  const service = db();
  let shareLabel = null;
  if (share?.type === "venue") {
    const { data: venue } = await service.from("venues").select("id,name").eq("id", share.id).maybeSingle();
    if (!venue) return NextResponse.json({ error: "Place not found" }, { status: 404 });
    shareLabel = `📍 ${venue.name}`;
  } else if (share?.type === "saved_list") {
    const { data: list } = await service.from("saved_lists").select("id,user_id,title,visibility,archived_at").eq("id", share.id).maybeSingle();
    if (!list || list.archived_at) return NextResponse.json({ error: "List not found" }, { status: 404 });
    const { data: friendship } = list.user_id !== user.id && list.visibility === "friends"
      ? await service.from("friendships").select("id").eq("status", "accepted").or(`and(requester_id.eq.${user.id},addressee_id.eq.${list.user_id}),and(requester_id.eq.${list.user_id},addressee_id.eq.${user.id})`).maybeSingle()
      : { data: null };
    if (list.user_id !== user.id && list.visibility !== "public" && !friendship) return NextResponse.json({ error: "You cannot share that list" }, { status: 403 });
    if (list.user_id === user.id) await service.from("saved_list_group_shares").upsert({ list_id: list.id, group_id: id, shared_by: user.id });
    shareLabel = `📚 ${list.title}`;
  } else if (share?.type === "trip_board") {
    const { data: board } = await service.from("trip_boards").select("id,owner_id,title,visibility,archived_at").eq("id", share.id).maybeSingle();
    if (!board || board.archived_at) return NextResponse.json({ error: "Board not found" }, { status: 404 });
    const { data: member } = board.owner_id !== user.id ? await service.from("trip_board_members").select("user_id").eq("board_id", board.id).eq("user_id", user.id).maybeSingle() : { data: null };
    if (board.owner_id !== user.id && !member && board.visibility !== "public") return NextResponse.json({ error: "You cannot share that board" }, { status: 403 });
    shareLabel = `🗺️ ${board.title}`;
  } else if (share?.type === "poll") {
    const { data: poll } = await service.from("polls").select("id,short_code,expires_at,created_by,visibility").eq("id", share.id).maybeSingle();
    if (!poll || new Date(poll.expires_at) <= new Date()) return NextResponse.json({ error: "That vote is no longer available" }, { status: 404 });
    if (poll.visibility !== "public" && poll.created_by !== user.id) return NextResponse.json({ error: "Only the creator can share that private vote" }, { status: 403 });
    shareLabel = "🗳️ Vote on where we should go";
  }

  const { data: message, error } = await supabase
    .from("group_messages")
    .insert({ group_id: id, user_id: user.id, body: checked.text || shareLabel, share_type: share?.type || null, share_id: share?.id || null })
    .select("id, body, user_id, created_at, share_type, share_id")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't send that message" }, { status: 500 });

  notifyGroupMembers({ groupId: id, senderId: user.id, body: checked.text || shareLabel }).catch(() => {});

  return NextResponse.json({ ok: true, message });
}

async function notifyGroupMembers({ groupId, senderId, body }) {
  const s = db();
  const [{ data: group }, { data: members }, { data: sender }] = await Promise.all([
    s.from("friend_groups").select("name").eq("id", groupId).single(),
    s.from("friend_group_members").select("user_id").eq("group_id", groupId),
    s.from("profile_public").select("display_name").eq("id", senderId).single(),
  ]);
  const others = (members || []).map((m) => m.user_id).filter((id) => id !== senderId);
  await notifyMany(others, "group_message", {
    groupId,
    groupName: group?.name,
    senderName: sender?.display_name,
    preview: body.slice(0, 80),
  });
}
