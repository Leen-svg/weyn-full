import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const AGES = new Set(["all-ages", "18-plus", "21-plus"]);
const TYPES = new Set(["party", "club-night", "live-music", "brunch", "ladies-night", "other"]);

const cleanText = (value, max) => String(value || "").trim().slice(0, max) || null;
const cleanUrl = (value) => value ? normalizeHttpUrl(String(value)) : null;
const cleanDate = (value) => DATE.test(String(value || "")) ? String(value) : null;
const cleanTime = (value) => TIME.test(String(value || "").slice(0, 5)) ? String(value).slice(0, 5) : null;
const cleanDays = (value) => [...new Set((Array.isArray(value) ? value : []).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();

function dubaiTimestamp(date, time, nextDay = false) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (nextDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return `${parsed.toISOString().slice(0, 10)}T${time || "00:00"}:00+04:00`;
}

function eventValues(body) {
  const title = cleanText(body.title, 160);
  if (!title) return { error: "Event name required" };
  const startsOn = cleanDate(body.startsOn);
  if (!startsOn) return { error: "Choose a valid start date" };
  const recurrence = body.recurrenceType === "weekly" ? "weekly" : "none";
  const recurrenceDays = recurrence === "weekly" ? cleanDays(body.recurrenceDays) : [];
  if (recurrence === "weekly" && !recurrenceDays.length) return { error: "Choose at least one repeat day" };
  const recurrenceUntil = recurrence === "weekly" ? cleanDate(body.endsOn) : null;
  if (body.endsOn && recurrence === "weekly" && !recurrenceUntil) return { error: "Choose a valid repeat end date" };
  if (recurrenceUntil && recurrenceUntil < startsOn) return { error: "Repeat end date must be after the start date" };

  for (const [label, value] of [["image", body.imageUrl], ["booking", body.ticketUrl], ["website", body.websiteUrl], ["social media", body.socialUrl]]) {
    if (value && !cleanUrl(value)) return { error: `Use a valid HTTPS ${label} link` };
  }
  const phone = cleanText(body.reservationPhone, 40);
  if (phone && !/^[+\d][\d\s().-]{4,39}$/.test(phone)) return { error: "Use a valid reservation phone number" };
  const startTime = cleanTime(body.startTime);
  const endTime = cleanTime(body.endTime);
  if (body.startTime && !startTime) return { error: "Choose a valid start time" };
  if (body.endTime && !endTime) return { error: "Choose a valid end time" };
  const price = Number(body.priceFromAed);

  return { values: {
    title, description: cleanText(body.description, 1000), venue_id: UUID.test(body.venueId || "") ? body.venueId : null,
    city: body.city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai", neighborhood: cleanText(body.location, 180),
    starts_at: dubaiTimestamp(startsOn, startTime),
    ends_at: endTime ? dubaiTimestamp(startsOn, endTime, !!(startTime && endTime < startTime)) : null,
    recurrence, recurrence_until: recurrenceUntil, recurrence_days: recurrenceDays,
    age_restriction: AGES.has(body.ageRestriction) ? body.ageRestriction : "21-plus",
    event_type: TYPES.has(body.eventType) ? body.eventType : "party",
    cover_image_url: cleanUrl(body.imageUrl), ticket_url: cleanUrl(body.ticketUrl), website_url: cleanUrl(body.websiteUrl),
    social_url: cleanUrl(body.socialUrl), reservation_phone: phone,
    price_from_aed: Number.isFinite(price) && price >= 0 ? Math.min(100000, Math.round(price)) : null,
    sort_order: Number.isInteger(body.sortOrder) && body.sortOrder >= 0 ? Math.min(body.sortOrder, 99999) : 0,
    is_trending: !!body.isTrending, is_try_this_out: !!body.isTryThisOut, is_active: !!body.isPublished,
  } };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await db().from("events").select("*, next_start, venues(id, name, neighborhood)").order("sort_order").order("starts_at").order("created_at").limit(300);
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
    const ids = body.order.filter((id) => UUID.test(id));
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
  if (!UUID.test(body.id || "")) return NextResponse.json({ error: "Valid event id required" }, { status: 400 });
  const cleaned = eventValues(body);
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const { error } = await s.from("events").update(cleaned.values).eq("id", body.id);
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
