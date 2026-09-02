import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { EVENT_UUID, eventValues } from "@/lib/admin-event-values.mjs";


export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await db().from("events").select("*, next_start, venues(id, name, neighborhood, city)").order("sort_order").order("starts_at", { nullsFirst: false }).order("created_at").limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] });
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const cleaned = eventValues(body);
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const { data, error } = await db().from("events").insert(cleaned.values).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const s = db();
  if (Array.isArray(body.order)) {
    const ids = body.order.filter((id) => EVENT_UUID.test(id));
    if (ids.length !== body.order.length || new Set(ids).size !== ids.length) return NextResponse.json({ error: "Invalid event order" }, { status: 400 });
    const { data, error: lookupError } = ids.length ? await s.from("events").select("id").in("id", ids) : { data: [], error: null };
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
    if ((data || []).length !== ids.length) return NextResponse.json({ error: "One or more events no longer exist" }, { status: 409 });
    for (let index = 0; index < ids.length; index += 1) {
      const { error } = await s.from("events").update({ sort_order: index }).eq("id", ids[index]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  if (!EVENT_UUID.test(body.id || "")) return NextResponse.json({ error: "Valid event id required" }, { status: 400 });
  const cleaned = eventValues(body);
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const { error } = await s.from("events").update(cleaned.values).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!EVENT_UUID.test(id || "")) return NextResponse.json({ error: "Valid event id required" }, { status: 400 });
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
