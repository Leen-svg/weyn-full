import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = db();
  const [{ data: categories }, { data: tags }] = await Promise.all([
    s.from("categories").select("id, slug, name, display_order, max_select").order("display_order"),
    s.from("vibe_tags").select("id, category_id, slug, display_name, subgroup, is_active, seasonal_exclude").order("display_order"),
  ]);
  return NextResponse.json({ categories: categories || [], tags: tags || [] });
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { categoryId, displayName, subgroup } = await req.json();
  if (!categoryId || !displayName?.trim()) return NextResponse.json({ error: "categoryId and displayName required" }, { status: 400 });

  const slug = displayName
    .toLowerCase()
    .replace(/[^\w\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);

  const { error } = await db().from("vibe_tags").insert({
    category_id: categoryId,
    display_name: displayName.trim().slice(0, 60),
    slug,
    subgroup: subgroup?.trim() || null,
    is_active: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, patch } = await req.json();
  if (!id || !patch) return NextResponse.json({ error: "id and patch required" }, { status: 400 });
  const allowed = ["is_active", "seasonal_exclude", "display_name", "subgroup"];
  const clean = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];

  const { error } = await db().from("vibe_tags").update(clean).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

