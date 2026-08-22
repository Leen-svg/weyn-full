import { cookies } from "next/headers";
export { BETA_ACCESS_COOKIE, makeBetaAccessToken, verifyBetaAccessToken } from "./beta-token.mjs";
import { BETA_ACCESS_COOKIE, BETA_ACCESS_MAX_AGE, verifyBetaAccessToken } from "./beta-token.mjs";

export async function hasBetaAccess() {
  const store = await cookies();
  return verifyBetaAccessToken(store.get(BETA_ACCESS_COOKIE)?.value);
}

export const betaCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: BETA_ACCESS_MAX_AGE,
};

