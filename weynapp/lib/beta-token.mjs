import crypto from "node:crypto";

export const BETA_ACCESS_COOKIE = "weyn_beta_access";
export const BETA_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  return process.env.BETA_INVITE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function signature(expiresAt) {
  const key = secret();
  if (!key) return "";
  return crypto.createHmac("sha256", key).update(String(expiresAt)).digest("base64url");
}

export function makeBetaAccessToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + BETA_ACCESS_MAX_AGE;
  return `${expiresAt}.${signature(expiresAt)}`;
}

export function verifyBetaAccessToken(token) {
  if (!token || !secret()) return false;
  const [expiresAt, supplied] = String(token).split(".");
  if (!expiresAt || !supplied || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expected = signature(expiresAt);
  if (!expected || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

