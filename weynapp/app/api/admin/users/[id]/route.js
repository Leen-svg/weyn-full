import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const s = db();

  const [{ data: reviews }, { data: saves }, { data: posts }] = await Promise.all([
    s.from("reviews").select("id, rating, body, aesthetic_taste, quiet_loud, wallet_splurge, created_at, venue_id, venues (name)").eq("user_id", id).order("created_at", { ascending: false }),
    s.from("saves").select("venue_id, venues (name)").eq("user_id", id),
    s.from("posts").select("id, body, visibility, created_at, venues (name)").eq("user_id", id).order("created_at", { ascending: false }),
  ]);
  return NextResponse.json({ reviews: reviews || [], saves: saves || [], posts: posts || [] });
}

export async function PATCH(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { banned, reason } = await req.json();
  const s = db();

  const { error: authErr } = await s.auth.admin.updateUserById(id, {
    ban_duration: banned ? "876000h" : "none", // ~100 years / unban
  });
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

  const { error } = await s.from("profiles").update({ is_banned: !!banned, banned_reason: banned ? (reason || null) : null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
