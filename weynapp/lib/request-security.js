import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";

function keyFor(req, actor = "") {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const secret = process.env.RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${actor}|${ip}|${userAgent}`).digest("hex");
}

export async function rateLimit(req, action, limit, windowSeconds, actor = "") {
  const keyHash = keyFor(req, actor);
  if (!keyHash) {
    console.error("RATE_LIMIT_SECRET and SUPABASE_SERVICE_ROLE_KEY are unavailable");
    return { allowed: false, unavailable: true };
  }
  const { data, error } = await db().rpc("consume_request_rate_limit", {
    p_key_hash: keyHash,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("Rate limit unavailable", { action, code: error.code });
    return { allowed: true, unavailable: true };
  }
  return { allowed: data === true, unavailable: false };
}

