import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/public";

// The static marketing pages in /public never need a session. Skipping them
// keeps the landing page fast instead of paying for an auth round trip.
const STATIC_PAGES = new Set(["/", "/about", "/roadmap", "/contact", "/privacy", "/terms"]);

// Mirrors lib/beta-token.mjs, but the proxy runs on the Edge runtime where
// Node's `crypto` module isn't available, so this re-implements the same
// HMAC-SHA256 check with Web Crypto. Keep BETA_ACCESS_COOKIE and the token
// format in sync with lib/beta-token.mjs if either changes.
const BETA_ACCESS_COOKIE = "weyn_beta_access";

function base64UrlEncode(buffer) {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyBetaAccessToken(token) {
  const secret = process.env.BETA_INVITE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!token || !secret) return false;
  const [expiresAt, supplied] = String(token).split(".");
  if (!expiresAt || !supplied || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(expiresAt)));
  const expected = base64UrlEncode(signature);
  return timingSafeEqual(supplied, expected);
}

// API routes real users can hit with no invitation code: redeeming a code
// itself, uptime checks, the marketing page's waitlist form, and the
// "friends vote with no account" share links (poll-by-code, group-poll-by-token).
const PUBLIC_API_PREFIXES = ["/api/beta-access", "/api/health", "/api/waitlist", "/api/polls/", "/api/vote/"];

// Refreshes the Supabase auth session cookie on every request so users stay
// logged in across visits. Standard @supabase/ssr Next.js App Router pattern.
export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }
  if (STATIC_PAGES.has(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (pathname.startsWith("/api/") && !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const betaToken = request.cookies.get(BETA_ACCESS_COOKIE)?.value;
    if (!user && !(await verifyBetaAccessToken(betaToken))) {
      return NextResponse.json({ error: "Invitation code required." }, { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|html|ico|txt)$).*)"],
};
