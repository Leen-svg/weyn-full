import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BETA_ACCESS_COOKIE, betaCookieOptions, makeBetaAccessToken } from "@/lib/beta-access";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

function hashCode(code) {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export async function POST(req) {
  if (payloadTooLarge(req, 2048)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "beta-invite", 12, 15 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });

  const { code } = await req.json();
  const normalized = String(code || "").trim().toUpperCase().slice(0, 80);
  if (!normalized) return NextResponse.json({ error: "Enter your invitation code." }, { status: 400 });

  const configured = String(process.env.BETA_INVITATION_CODE || "YALLA WEYN").trim().toUpperCase();
  let valid = configured && normalized === configured;
  let inviteId = null;
  if (!valid) {
    const { data } = await db()
      .from("beta_invitation_codes")
      .select("id, max_uses, use_count, expires_at, is_active")
      .eq("code_hash", hashCode(normalized))
      .maybeSingle();
    valid = !!data?.is_active && (!data.expires_at || new Date(data.expires_at) > new Date()) && data.use_count < data.max_uses;
    inviteId = valid ? data.id : null;
  }
  if (!valid) return NextResponse.json({ error: "That invitation code is not valid." }, { status: 403 });

  if (inviteId) await db().rpc("redeem_beta_invitation", { invitation_id: inviteId });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(BETA_ACCESS_COOKIE, makeBetaAccessToken(), betaCookieOptions);
  return response;
}


