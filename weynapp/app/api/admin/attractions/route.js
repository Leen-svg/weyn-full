import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { safeUrl } from "@/lib/sanitize";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGES = new Set(["all-ages", "18-plus", "21-plus"]);
const CATEGORIES = new Set([
  "theme-park", "waterpark", "desert-safari", "landmark",
  "cruise", "tour", "show", "museum", "adventure", "other",
]);

function clean(body) {
  const title = String(body.title || "").trim().slice(0, 160);
  if (!title) return { error: "Title is required" };

  // The booking link is the whole point of the row — a broken or non-http
  // one would render a card that cannot be booked.
  const affiliate = body.affiliateUrl ? safeUrl(String(body.affiliateUrl).trim()) : null;
  if (!affiliate) return { error: "A valid https booking link is required" };

  const price = Number(body.priceFromAed);
  return {
    row: {
      title,
      description: String(body.description || "").trim().slice(0, 1000) || null,
      city: body.city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai",
      neighborhood: String(body.neighborhood || "").trim().slice(0, 120) || null,
      category: CATEGORIES.has(body.category) ? body.category : "other",
      cover_image_url: body.coverImageUrl ? safeUrl(String(body.coverImageUrl).trim()) : null,
      affiliate_url: affiliate,
      partner: String(body.partner || "platinumlist").trim().slice(0, 60) || "platinumlist",
      price_from_aed: Number.isFinite(price) && price >= 0 ? Math.min(100000, Math.round(price)) : null,
      age_restriction: AGES.has(body.ageRestriction) ? body.ageRestriction : "all-ages",
      sort_order: Number.isInteger(body.sortOrder) ? body.sortOrder : 0,
      is_active: body.isActive !== false,
    },
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await db()
    .from("attractions")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attractions: data || [] });
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Accept a single row or a pasted batch, so a list of partner links can be
  // loaded in one go rather than one form submit at a time.
  const rows = Array.isArray(body.rows) ? body.rows : [body];
  const cleaned = [];
  const errors = [];
  rows.forEach((raw, i) => {
    const { row, error } = clean(raw);
    if (error) errors.push(`Row ${i + 1}: ${error}`);
    else cleaned.push(row);
  });
  if (!cleaned.length) return NextResponse.json({ error: errors[0] || "Nothing to add", errors }, { status: 400 });

  const { data, error } = await db().from("attractions").insert(cleaned).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: data?.length || 0, errors });
}

export async function PATCH(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (Array.isArray(body?.order)) {
    const ids = body.order.filter((id) => UUID.test(id));
    if (ids.length !== body.order.length || new Set(ids).size !== ids.length) return NextResponse.json({ error: "Invalid attraction order" }, { status: 400 });
    const service = db();
    const { data, error: lookupError } = ids.length ? await service.from("attractions").select("id").in("id", ids) : { data: [], error: null };
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
    if ((data || []).length !== ids.length) return NextResponse.json({ error: "One or more attractions no longer exist" }, { status: 409 });
    for (let index = 0; index < ids.length; index += 1) {
      const { error } = await service.from("attractions").update({ sort_order: index }).eq("id", ids[index]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  if (!UUID.test(body?.id || "")) return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  const { row, error: invalid } = clean(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { error } = await db().from("attractions").update(row).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!UUID.test(id || "")) return NextResponse.json({ error: "Valid id required" }, { status: 400 });
  const { error } = await db().from("attractions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
