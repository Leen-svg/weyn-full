import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to see your groups" }, { status: 401 });

  // RLS scopes this to groups the caller is a member of.
  const { data: memberships, error } = await supabase
    .from("friend_group_members")
    .select("group_id, friend_groups (id, name, created_by, created_at)")
    .order("joined_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const groupIds = (memberships || []).map((m) => m.group_id);
  const s = db();
  const { data: allMembers } = groupIds.length
    ? await s.from("friend_group_members").select("group_id, user_id").in("group_id", groupIds)
    : { data: [] };
  const { data: authors } = groupIds.length
    ? await s
        .from("profile_public")
        .select("id, display_name, avatar_url")
        .in("id", [...new Set((allMembers || []).map((m) => m.user_id))])
    : { data: [] };
  const { data: recentMessages } = groupIds.length
    ? await s.from("group_messages").select("group_id, created_at").in("group_id", groupIds).order("created_at", { ascending: false })
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((a) => [a.id, a]));
  const recentMap = {};
  for (const message of recentMessages || []) {
    if (!recentMap[message.group_id]) recentMap[message.group_id] = message.created_at;
  }

  const groups = (memberships || [])
    .map((m) => m.friend_groups)
    .filter(Boolean)
    .map((g) => ({
      ...g,
      recent_at: recentMap[g.id] || g.created_at,
      members: (allMembers || [])
        .filter((mm) => mm.group_id === g.id)
        .map((mm) => authorMap[mm.user_id])
        .filter(Boolean),
    }))
    .sort((a, b) => new Date(b.recent_at) - new Date(a.recent_at));

  return NextResponse.json({ groups });
}

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to create a group" }, { status: 401 });

  const { name, memberIds } = await req.json();
  const trimmed = (name || "").trim().slice(0, 60);
  const ids = Array.isArray(memberIds) ? [...new Set(memberIds)].filter((id) => id !== user.id) : [];
  if (!trimmed) return NextResponse.json({ error: "Give your group a name" }, { status: 400 });
  if (ids.length === 0) return NextResponse.json({ error: "Add at least one friend" }, { status: 400 });

  // Every added member must be an accepted friend of the creator, checked
  // server-side against the real friendships table, not trusted from the client.
  const { data: friendRows } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  const friendIds = new Set(
    (friendRows || []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id))
  );
  const invalid = ids.filter((id) => !friendIds.has(id));
  if (invalid.length > 0) return NextResponse.json({ error: "You can only add accepted friends" }, { status: 400 });

  const s = db();
  const { data: group, error } = await s.from("friend_groups").insert({ name: trimmed, created_by: user.id }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: e2 } = await s.from("friend_group_members").insert([
    { group_id: group.id, user_id: user.id },
    ...ids.map((id) => ({ group_id: group.id, user_id: id })),
  ]);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ id: group.id });
}

