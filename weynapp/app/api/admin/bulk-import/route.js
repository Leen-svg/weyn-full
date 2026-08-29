import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { safeUrl } from "@/lib/sanitize";
import { isCurationFormat, importCurationRecords } from "@/lib/venueImport";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VENUE_FIELDS = [
  "name", "neighborhood", "city", "avg_spend_aed", "google_maps_url", "hero_video_url", "menu_url",
  "description", "zone_slug", "category", "cuisine", "age_restriction", "is_aesthetic",
  "latitude", "longitude",
  // Contact + booking, as exported by the nightlife link resolver.
  "phone", "booking_phone", "booking_url", "website", "opening_hours",
];

// Phone numbers arrive formatted for humans ("+971 4 123 4567"). Keep the
// digits and a leading +, so a tel: link actually dials.
function cleanPhone(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^\d+]/g, "");
  return /\d{6,}/.test(normalized) ? normalized.slice(0, 32) : null;
}

function parseRows(buffer, filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
    return buffer
      .toString("utf-8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }
  if (lower.endsWith(".json")) {
    const parsed = JSON.parse(buffer.toString("utf-8"));
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  // xlsx / xls / csv, all readable by the same sheet parser
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

function cleanRow(row) {
  const clean = {};
  for (const f of VENUE_FIELDS) {
    if (row[f] === undefined || row[f] === null || row[f] === "") continue;
    clean[f] = row[f];
  }
  if (clean.city && clean.city !== "Dubai") clean.city = "Abu Dhabi";
  if (!clean.city) clean.city = "Abu Dhabi";
  if (clean.avg_spend_aed != null) clean.avg_spend_aed = Number(clean.avg_spend_aed) || 0;
  if (clean.latitude != null) clean.latitude = Number(clean.latitude);
  if (clean.longitude != null) clean.longitude = Number(clean.longitude);
  if (clean.is_aesthetic != null) clean.is_aesthetic = clean.is_aesthetic === true || clean.is_aesthetic === "true" || clean.is_aesthetic === 1;
  if (clean.google_maps_url) clean.google_maps_url = safeUrl(clean.google_maps_url);
  if (clean.hero_video_url) clean.hero_video_url = safeUrl(clean.hero_video_url);
  if (clean.menu_url) clean.menu_url = safeUrl(clean.menu_url);
  if (clean.booking_url) clean.booking_url = safeUrl(clean.booking_url);
  if (clean.website) clean.website = safeUrl(clean.website);
  if (clean.phone !== undefined) clean.phone = cleanPhone(clean.phone);
  if (clean.booking_phone !== undefined) clean.booking_phone = cleanPhone(clean.booking_phone);
  // Hours may arrive as a JSON string from a spreadsheet cell.
  if (typeof clean.opening_hours === "string") {
    try { clean.opening_hours = JSON.parse(clean.opening_hours); } catch { delete clean.opening_hours; }
  }
  // Drop keys that cleaned down to nothing, so an empty column never wipes
  // a value that is already correct in the database.
  for (const key of ["phone", "booking_phone", "booking_url", "website"]) {
    if (clean[key] == null) delete clean[key];
  }
  return clean;
}

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "File too big, 15MB max" }, { status: 400 });

  let rows;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rows = parseRows(buffer, file.name);
  } catch (e) {
    return NextResponse.json({ error: `Couldn't parse file: ${e.message}` }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "No rows found in file" }, { status: 400 });
  if (rows.length > 2000) return NextResponse.json({ error: "Max 2000 rows per import, split the file" }, { status: 400 });

  // The scraping/tagging pipeline's export ({ venue_id, name, curation: {...}, metadata: {...} })
  // gets its own richer path: tag buckets -> categories/vibe_tags, price band -> avg_spend_aed,
  // lat/lng -> city + nearest zone, gallery_images -> venue_media (with junk/duplicate filtering).
  if (isCurationFormat(rows[0])) {
    try {
      const summary = await importCurationRecords(rows);
      return NextResponse.json({
        inserted: summary.inserted,
        updated: summary.updated,
        skipped: summary.errors.length,
        total: rows.length,
        errors: summary.errors.slice(0, 20),
        newTagsCreated: summary.newTagsCreated,
        mediaAdded: summary.mediaAdded,
        mediaSkippedJunk: summary.mediaSkippedJunk,
        mediaSkippedDuplicate: summary.mediaSkippedDuplicate,
      });
    } catch (e) {
      return NextResponse.json({ error: `Import failed: ${e.message}` }, { status: 500 });
    }
  }

  const s = db();
  let inserted = 0,
    updated = 0,
    skipped = 0;
  const errors = [];

  for (const raw of rows) {
    if (!raw.name?.trim?.()) {
      skipped++;
      continue;
    }
    const clean = cleanRow(raw);
    try {
      let existingId = UUID.test(raw.id || "") ? raw.id : null;
      if (!existingId) {
        const { data: existing } = await s
          .from("venues")
          .select("id")
          .ilike("name", clean.name)
          .eq("neighborhood", clean.neighborhood || "")
          .maybeSingle();
        existingId = existing?.id || null;
      }
      if (existingId) {
        const { error } = await s.from("venues").update(clean).eq("id", existingId);
        if (error) throw error;
        updated++;
      } else {
        const { error } = await s.from("venues").insert({ ...clean, is_active: true });
        if (error) throw error;
        inserted++;
      }
    } catch (e) {
      skipped++;
      if (errors.length < 20) errors.push(`${raw.name}: ${e.message}`);
    }
  }

  return NextResponse.json({ inserted, updated, skipped, total: rows.length, errors });
}
