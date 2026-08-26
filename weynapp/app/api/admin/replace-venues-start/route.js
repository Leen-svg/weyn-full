import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

// Wipes every venue (cascades venue_tags, venue_media, poll_options, saves,
// reviews, etc.) so the next chunked import populates a fully fresh set.
// Deliberately a separate, explicit step — the admin UI only calls this after
// the user confirms a destructive "replace all" action.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const s = db();
  const { count: before } = await s.from("venues").select("id", { count: "exact", head: true });
  const { error } = await s.from("venues").delete().not("id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deleted: before || 0 });
}

