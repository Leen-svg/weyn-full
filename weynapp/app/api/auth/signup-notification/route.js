import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyNewSignup } from "@/lib/signup-notification";
import { isCrossSiteMutation, payloadTooLarge } from "@/lib/request-security.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req) {
  if (isCrossSiteMutation(req)) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  if (payloadTooLarge(req, 2048)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { userId, source } = await req.json().catch(() => ({}));
  if (!UUID.test(userId || "")) return NextResponse.json({ error: "Invalid user" }, { status: 400 });

  const { data, error } = await db().auth.admin.getUserById(userId);
  if (error || !data?.user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const ageMs = Date.now() - new Date(data.user.created_at).getTime();
  if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1000) return NextResponse.json({ ok: true });

  await notifyNewSignup(data.user, source === "google" ? "google" : "email").catch((cause) => console.error("Signup notification error", cause));
  return NextResponse.json({ ok: true });
}
