import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { safeUrl } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

const VENUE_FIELDS = [
  "name", "neighborhood", "city", "avg_spend_aed", "google_maps_url", "hero_video_url",
  "description", "zone_slug", "category", "cuisine", "age_restriction", "is_aesthetic",
  "latitude", "longitude",
];

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
      let existingId = raw.id || null;
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
