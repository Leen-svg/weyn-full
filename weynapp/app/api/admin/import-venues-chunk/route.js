import { requireAdmin } from "@/lib/admin";
import { importCurationRecords } from "@/lib/venueImport";
import { NextResponse } from "next/server";

export const maxDuration = 120;

// Chunked counterpart to /api/admin/bulk-import for the curation-batch format —
// the admin UI slices a large drop into small pieces client-side and calls this
// repeatedly, since importing hundreds of venues sequentially in one request
// can outrun a serverless function's time limit.
export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "No rows in chunk" }, { status: 400 });
  if (rows.length > 60) return NextResponse.json({ error: "Max 60 rows per chunk" }, { status: 400 });

  try {
    const summary = await importCurationRecords(rows);
    return NextResponse.json(summary);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
