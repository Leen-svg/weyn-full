import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data, error } = await db()
    .from("venues")
    .select("id, name, neighborhood")
    .eq("is_active", true)
    .ilike("name", `%${q}%`)
    .limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data || [] });
}
