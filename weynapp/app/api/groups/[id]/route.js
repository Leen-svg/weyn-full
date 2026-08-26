import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const VISIBILITIES = new Set(["private", "friends", "public"]);

async function authenticatedGroup(req, id) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Log in" }, { status: 401 }) };
  const service = db();
  const [{ data: group }, { data: membership }] = await Promise.all([
    service.from("friend_groups").select("id,name,created_by,visibility,archived_at,created_at").eq("id", id).maybeSingle(),
    service.from("friend_group_members").select("group_id").eq("group_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!group || !membership) return { error: NextResponse.json({ error: "Group not found" }, { status: 404 }) };
  return { supabase, service, user, group };
}

export async function GET(req, { params }) {
  const { id } = await params;
  const auth = await authenticatedGroup(req, id);
  if (auth.error) return auth.error;
  const { data: memberRows } = await auth.service.from("friend_group_members").select("user_id").eq("group_id", id);
  const { data: authors } = await auth.service
    .from("profile_public")
    .select("id, display_name, avatar_url")
    .in("id", (memberRows || []).map((m) => m.user_id));

  return NextResponse.json({ group: auth.group, members: authors || [] });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const auth = await authenticatedGroup(req, id);
  if (auth.error) return auth.error;
  if (auth.group.created_by !== auth.user.id) return NextResponse.json({ error: "Only the group creator can change these settings" }, { status: 403 });
  const body = await req.json();
  const update = {};
  if (body.action === "archive") update.archived_at = new Date().toISOString();
  else if (body.action === "restore") update.archived_at = null;
  else if (body.action === "visibility") {
    if (!VISIBILITIES.has(body.visibility)) return NextResponse.json({ error: "Choose Private, Friends, or Public" }, { status: 400 });
    update.visibility = body.visibility;
  } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const { error } = await auth.service.from("friend_groups").update(update).eq("id", id).eq("created_by", auth.user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, ...update });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const auth = await authenticatedGroup(req, id);
  if (auth.error) return auth.error;
  const query = auth.group.created_by === auth.user.id
    ? auth.service.from("friend_groups").delete().eq("id", id).eq("created_by", auth.user.id)
    : auth.service.from("friend_group_members").delete().eq("group_id", id).eq("user_id", auth.user.id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: auth.group.created_by === auth.user.id, left: auth.group.created_by !== auth.user.id });
}
