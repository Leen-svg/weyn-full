import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { venueId } = await req.json();
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const s = db();
  const { count } = await s.from("curated_list_venues").select("id", { count: "exact", head: true }).eq("list_id", id);
  const { error } = await s.from("curated_list_venues").insert({ list_id: id, venue_id: venueId, position: count || 0 });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That place is already on this list" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const venueId = new URL(req.url).searchParams.get("venueId");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { error } = await db().from("curated_list_venues").delete().eq("list_id", id).eq("venue_id", venueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
