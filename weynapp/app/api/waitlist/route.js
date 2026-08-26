import { db } from "@/lib/db";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { NextResponse } from "next/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "waitlist", 5, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  const { error } = await db().from("waitlist").insert({ email, city: "abu-dhabi", source: "landing" });
  if (error?.code === "23505") return NextResponse.json({ ok: true, existing: true });
  if (error) return NextResponse.json({ error: "Couldn't join the list right now" }, { status: 500 });
  return NextResponse.json({ ok: true });
}


