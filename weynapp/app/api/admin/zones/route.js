import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await db().from("zones").select("id, slug, name, emirate, is_active, display_order").order("emirate").order("display_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data || [] });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, emirate } = await req.json();
  if (!name?.trim() || !emirate?.trim()) return NextResponse.json({ error: "name and emirate required" }, { status: 400 });

  const slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

  const { error } = await db().from("zones").insert({ name: name.trim().slice(0, 80), emirate: emirate.trim().slice(0, 40), slug, is_active: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, patch } = await req.json();
  if (!id || !patch) return NextResponse.json({ error: "id and patch required" }, { status: 400 });
  const allowed = ["is_active", "name"];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];

  const { error } = await db().from("zones").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

