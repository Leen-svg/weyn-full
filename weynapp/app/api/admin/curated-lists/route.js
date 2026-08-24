import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = db();
  const { data: lists, error } = await s
    .from("curated_lists")
    .select("id, title, description, cover_image_url, is_active, position, created_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: links } = await s
    .from("curated_list_venues")
    .select("list_id, position, venues (id, name, neighborhood, city)")
    .order("position", { ascending: true });

  const venuesByList = {};
  for (const link of links || []) {
    (venuesByList[link.list_id] ||= []).push(link.venues);
  }

  return NextResponse.json({
    lists: (lists || []).map((list) => ({ ...list, venues: venuesByList[list.id] || [] })),
  });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description } = await req.json();
  const trimmed = (title || "").trim().slice(0, 120);
  if (!trimmed) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await db()
    .from("curated_lists")
    .insert({ title: trimmed, description: (description || "").trim().slice(0, 500) || null, created_by: admin.id })
    .select("id, title, description, cover_image_url, is_active, position, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ list: { ...data, venues: [] } });
}
