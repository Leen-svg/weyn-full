import test from "node:test";
import assert from "node:assert/strict";

test("beta access tokens are signed, expire, and reject tampering", async () => {
  process.env.BETA_INVITE_SECRET = "test-only-secret";
  const { makeBetaAccessToken, verifyBetaAccessToken } = await import("../lib/beta-token.mjs");
  const token = makeBetaAccessToken();
  assert.equal(verifyBetaAccessToken(token), true);
  assert.equal(verifyBetaAccessToken(`${token}x`), false);
  assert.equal(verifyBetaAccessToken(`1.${token.split(".")[1]}`), false);
});
