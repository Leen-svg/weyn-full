import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await req.json();
  const patch = {};
  if (typeof body.title === "string") {
    const trimmed = body.title.trim().slice(0, 120);
    if (!trimmed) return NextResponse.json({ error: "Title can't be empty" }, { status: 400 });
    patch.title = trimmed;
  }
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 500) || null;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (Number.isFinite(body.position)) patch.position = body.position;
  patch.updated_at = new Date().toISOString();

  const { error } = await db().from("curated_lists").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { error } = await db().from("curated_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
