import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { safeUrl } from "@/lib/sanitize";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cleanIds = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => UUID.test(id)))].slice(0, 50);
const cleanCity = (city) => city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai";
const cleanSection = (section) => section === "our_picks" ? "our_picks" : "curated";
const cleanImage = (value) => value ? safeUrl(String(value).trim()) : null;
const makeSlug = (title) => `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "weyn-list"}-${randomUUID().slice(0, 8)}`;

async function replaceItems(s, listId, venueIds) {
  const ids = cleanIds(venueIds);
  if (ids.length) {
    const { data, error } = await s.from("venues").select("id").in("id", ids).eq("is_active", true);
    if (error) return error;
    if ((data || []).length !== ids.length) return new Error("One or more places are unavailable");
  }
  const { error: deleteError } = await s.from("editorial_list_items").delete().eq("list_id", listId);
  if (deleteError) return deleteError;
  if (!ids.length) return null;
  const { error } = await s.from("editorial_list_items").insert(ids.map((venue_id, position) => ({ list_id: listId, venue_id, position })));
  return error;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await db().from("editorial_lists").select("id, title, subtitle, slug, city, header_image_url, home_section, sort_order, is_published, editorial_list_items(venue_id, position, venues(id, name, neighborhood, city))").order("home_section").order("sort_order").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lists: data || [] });
}

export async function POST(req) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const title = String(body.title || "").trim().slice(0, 100);
  if (!title) return NextResponse.json({ error: "List name required" }, { status: 400 });
  const image = cleanImage(body.headerImageUrl);
  if (body.headerImageUrl && !image) return NextResponse.json({ error: "Use a valid HTTPS header image link" }, { status: 400 });
  const s = db();
  const { data, error } = await s.from("editorial_lists").insert({ title, subtitle: String(body.subtitle || "").trim().slice(0, 240) || null, slug: makeSlug(title), city: cleanCity(body.city), header_image_url: image, home_section: cleanSection(body.homeSection), sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0, is_published: !!body.isPublished }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const itemError = await replaceItems(s, data.id, body.venueIds);
  if (itemError) { await s.from("editorial_lists").delete().eq("id", data.id); return NextResponse.json({ error: itemError.message }, { status: 400 }); }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  if (!UUID.test(body.id || "")) return NextResponse.json({ error: "Valid list id required" }, { status: 400 });
  const title = String(body.title || "").trim().slice(0, 100);
  if (!title) return NextResponse.json({ error: "List name required" }, { status: 400 });
  const image = cleanImage(body.headerImageUrl);
  if (body.headerImageUrl && !image) return NextResponse.json({ error: "Use a valid HTTPS header image link" }, { status: 400 });
  const s = db();
  const { error } = await s.from("editorial_lists").update({ title, subtitle: String(body.subtitle || "").trim().slice(0, 240) || null, city: cleanCity(body.city), header_image_url: image, home_section: cleanSection(body.homeSection), sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0, is_published: !!body.isPublished, updated_at: new Date().toISOString() }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const itemError = await replaceItems(s, body.id, body.venueIds);
  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  if (!UUID.test(id || "")) return NextResponse.json({ error: "Valid list id required" }, { status: 400 });
  const { error } = await db().from("editorial_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
