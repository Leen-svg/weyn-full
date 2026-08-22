import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { notifyMany } from "@/lib/notify";
import { NextResponse } from "next/server";
import { contentAccountError, validateCommunityText } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

export async function GET(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  // RLS enforces group membership, an empty result here can also mean "not a member".
  const { data, error } = await supabase
    .from("group_messages")
    .select("id, body, user_id, created_at")
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

  return NextResponse.json({ messages: messages.map((m) => ({ ...m, profile_public: authorMap[m.user_id] || null })) });
}

export async function POST(req, { params }) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });
  const limited = await rateLimit(req, "group-message", 100, 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "You're sending messages too quickly." }, { status: 429 });

  const { body } = await req.json();
  const checked = validateCommunityText(body, { required: true, maxLength: 1000 });
  if (checked.error) return NextResponse.json({ error: checked.error }, { status: 400 });

  const { data: message, error } = await supabase
    .from("group_messages")
    .insert({ group_id: id, user_id: user.id, body: checked.text })
    .select("id, body, user_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: "Couldn't send that message" }, { status: 500 });

  notifyGroupMembers({ groupId: id, senderId: user.id, body: checked.text }).catch(() => {});

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

