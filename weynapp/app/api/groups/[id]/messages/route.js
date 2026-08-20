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

  // RLS enforces group membership, an empty result here can also mean "not a member".
  const { data, error } = await supabase
    .from("group_messages")
    .select("id, body, user_id, created_at")
    .eq("group_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const { body } = await req.json();
  const trimmed = (body || "").trim().slice(0, 1000);
  if (!trimmed) return NextResponse.json({ error: "Say something first" }, { status: 400 });

  const { data: message, error } = await supabase
    .from("group_messages")
    .insert({ group_id: id, user_id: user.id, body: trimmed })
    .select("id, body, user_id, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message });
}

