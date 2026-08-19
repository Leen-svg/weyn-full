import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  // RLS returns nothing if the caller isn't a member of this group.
  const { data: group, error } = await supabase.from("friend_groups").select("id, name, created_by, created_at").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { data: memberRows } = await supabase.from("friend_group_members").select("user_id").eq("group_id", id);
  const s = db();
  const { data: authors } = await s
    .from("profile_public")
    .select("id, display_name, avatar_url")
    .in("id", (memberRows || []).map((m) => m.user_id));

  return NextResponse.json({ group, members: authors || [] });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const { error } = await supabase.from("friend_group_members").delete().eq("group_id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
