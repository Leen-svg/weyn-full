import { db } from "@/lib/db";
import { NextResponse } from "next/server";
export async function GET() { const { error } = await db().from("venues").select("id").limit(1); return NextResponse.json({ ok: !error, service: "weyn-app" }, { status: error ? 503 : 200, headers: { "cache-control": "no-store" } }); }


