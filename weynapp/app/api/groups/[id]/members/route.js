import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { contentAccountError } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

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
  const limited = await rateLimit(req, "group-member-add", 30, 24 * 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "Too many member changes. Try again later." }, { status: 429 });

  // Only a current member can add people, and only accepted friends of the
  // *actor* can be added, mirrors the group-creation validation.
  const { data: membership } = await supabase.from("friend_group_members").select("group_id").eq("group_id", id).eq("user_id", user.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: friendRows } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  const friendIds = new Set((friendRows || []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)));
  if (!friendIds.has(userId)) return NextResponse.json({ error: "You can only add accepted friends" }, { status: 400 });

  const s = db();
  const { count } = await s.from("friend_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", id);
  if ((count || 0) >= 21) return NextResponse.json({ error: "Groups can include up to 21 people." }, { status: 400 });
  const { error } = await s.from("friend_group_members").insert({ group_id: id, user_id: userId });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already in this group" }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId");
  if (!targetId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Anyone can remove themselves; only the group's creator can remove others.
  if (targetId !== user.id) {
    const { data: group } = await supabase.from("friend_groups").select("created_by").eq("id", id).maybeSingle();
    if (!group || group.created_by !== user.id) {
      return NextResponse.json({ error: "Only the group creator can remove other members" }, { status: 403 });
    }
    const s = db();
    const { error } = await s.from("friend_group_members").delete().eq("group_id", id).eq("user_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("friend_group_members").delete().eq("group_id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}


