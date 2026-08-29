import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { safeUrl } from "@/lib/sanitize";

export const maxDuration = 280;

// Backfills website, phone and opening hours from Google Places.
//
// Runs here rather than as a local script because GOOGLE_PLACES_API_KEY is a
// sensitive Vercel variable — it cannot be read back out, and it should not
// have to be.
//
// websiteUri, phone numbers and regularOpeningHours all sit in the same
// billing SKU, so requesting all three costs exactly what requesting the
// website alone would. One call per venue.
const FIELD_MASK = [
  "id",
  "websiteUri",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "regularOpeningHours.weekdayDescriptions",
].join(",");

function cleanPhone(value) {
  if (!value) return null;
  const normalized = String(value).replace(/[^\d+]/g, "");
  return /\d{6,}/.test(normalized) ? normalized.slice(0, 32) : null;
}

async function fetchPlace(placeId, key) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK }, cache: "no-store" }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || `lookup failed (${res.status})`);
  return body;
}

export async function POST(req) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY is not configured" }, { status: 503 });

  const { limit = 20, offset = 0 } = await req.json().catch(() => ({}));
  const size = Math.max(1, Math.min(25, Number(limit) || 20));

  // Only venues still missing all three, so re-running is cheap and never
  // overwrites something already filled in by hand or by the resolver.
  const s = db();
  const { data: rows, error } = await s
    .from("venues")
    .select("id, google_place_id, website, phone, opening_hours")
    .not("google_place_id", "is", null)
    .is("website", null)
    .is("phone", null)
    .order("created_at", { ascending: true })
    .range(Number(offset) || 0, (Number(offset) || 0) + size - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { attempted: rows?.length || 0, updated: 0, noData: 0, errors: [] };
  if (!rows?.length) return NextResponse.json({ ...summary, done: true });

  // Small concurrency: enough to be quick, not enough to trip Google's limits.
  const concurrency = 5;
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((v) => fetchPlace(v.google_place_id, key)));

    for (let j = 0; j < results.length; j += 1) {
      const venue = batch[j];
      const result = results[j];
      if (result.status === "rejected") {
        summary.errors.push(`${venue.google_place_id}: ${result.reason?.message || "failed"}`);
        continue;
      }
      const place = result.value;
      const patch = {};
      const website = place.websiteUri ? safeUrl(place.websiteUri) : null;
      const phone = cleanPhone(place.internationalPhoneNumber || place.nationalPhoneNumber);
      const hours = place.regularOpeningHours?.weekdayDescriptions;

      if (website) patch.website = website;
      if (phone) patch.phone = phone;
      if (Array.isArray(hours) && hours.length) patch.opening_hours = hours;

      if (!Object.keys(patch).length) {
        summary.noData += 1;
        continue;
      }
      const { error: updateError } = await s.from("venues").update(patch).eq("id", venue.id);
      if (updateError) summary.errors.push(`${venue.google_place_id}: ${updateError.message}`);
      else summary.updated += 1;
    }
  }

  return NextResponse.json({ ...summary, done: rows.length < size });
}

// How much is left, so the UI can show real progress rather than a spinner.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const s = db();
  const [{ count: remaining }, { count: withWebsite }, { count: total }] = await Promise.all([
    s.from("venues").select("id", { count: "exact", head: true })
      .not("google_place_id", "is", null).is("website", null).is("phone", null),
    s.from("venues").select("id", { count: "exact", head: true }).not("website", "is", null),
    s.from("venues").select("id", { count: "exact", head: true }),
  ]);
  return NextResponse.json({ remaining: remaining || 0, withWebsite: withWebsite || 0, total: total || 0 });
}
