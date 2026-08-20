import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/request-security";

export async function GET(req) {
  const limited = await rateLimit(req, "venue-search", 120, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many searches. Try again later." }, { status: 429 });
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 80).replace(/[%_]/g, "");
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data, error } = await db()
    .from("venues")
    .select("id, name, neighborhood")
    .eq("is_active", true)
    .ilike("name", `%${q}%`)
    .limit(8);
  if (error) return NextResponse.json({ error: "Search is temporarily unavailable" }, { status: 500 });
  return NextResponse.json({ results: data || [] });
}

