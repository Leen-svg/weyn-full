import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { safeUrl } from "@/lib/sanitize";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGES = new Set(["all-ages", "18-plus", "21-plus"]);
const TYPES = new Set(["party", "club-night", "live-music", "brunch", "ladies-night", "other"]);

function clean(body) {
  const title = String(body.title || "").trim().slice(0, 160);
  if (!title) return { error: "Title is required" };
  const startsAt = new Date(body.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: "A valid start date and time is required" };
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) return { error: "That end time isn't valid" };
  if (endsAt && endsAt < startsAt) return { error: "The end time is before the start time" };

  const recurrence = body.recurrence === "weekly" ? "weekly" : "none";
  let recurrenceUntil = null;
  if (recurrence === "weekly") {
    if (!body.recurrenceUntil) return { error: "A weekly event needs a repeat-until date" };
    const until = new Date(body.recurrenceUntil);
    if (Number.isNaN(until.getTime())) return { error: "That repeat-until date isn't valid" };
    // Otherwise the series is over before it starts and would never show.
    if (until < startsAt) return { error: "Repeat-until is before the first date" };
    recurrenceUntil = String(body.recurrenceUntil).slice(0, 10);
  }

  const price = Number(body.priceFromAed);

  return {
    row: {
      title,
      description: String(body.description || "").trim().slice(0, 1000) || null,
      venue_id: UUID.test(body.venueId || "") ? body.venueId : null,
      city: body.city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai",
      neighborhood: String(body.neighborhood || "").trim().slice(0, 120) || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt ? endsAt.toISOString() : null,
      recurrence,
      recurrence_until: recurrenceUntil,
      age_restriction: AGES.has(body.ageRestriction) ? body.ageRestriction : "all-ages",
      event_type: TYPES.has(body.eventType) ? body.eventType : "party",
      cover_image_url: body.coverImageUrl ? safeUrl(String(body.coverImageUrl).trim()) : null,
      ticket_url: body.ticketUrl ? safeUrl(String(body.ticketUrl).trim()) : null,
      price_from_aed: Number.isFinite(price) && price >= 0 ? Math.min(100000, Math.round(price)) : null,
      is_active: body.isActive !== false,
    },
  };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Admin sees expired events too — that's how you notice the catalogue
  // rotting. next_start is null for anything with nothing left to run.
  const { data, error } = await db()
    .from("events")
    .select("*, next_start, venues(id, name, neighborhood)")
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] });
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { row, error: invalid } = clean(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { data, error } = await db().from("events").insert(row).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!UUID.test(body?.id || "")) return NextResponse.json({ error: "Valid event id required" }, { status: 400 });
  const { row, error: invalid } = clean(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { error } = await db().from("events").update(row).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!UUID.test(id || "")) return NextResponse.json({ error: "Valid event id required" }, { status: 400 });
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
