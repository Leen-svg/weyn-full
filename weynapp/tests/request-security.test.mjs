import test from "node:test";
import assert from "node:assert/strict";
import { cleanStringList, isCrossSiteMutation, payloadTooLarge, safeRelativePath, validCoordinates } from "../lib/request-security.mjs";

function request(method, headers = {}) {
  return { method, headers: new Headers(headers) };
}

test("safeRelativePath rejects protocol-relative and encoded redirect escapes", () => {
  assert.equal(safeRelativePath("/groups"), "/groups");
  assert.equal(safeRelativePath("//evil.example"), "/app");
  assert.equal(safeRelativePath("/%2f%2fevil.example"), "/app");
  assert.equal(safeRelativePath("/\\evil.example"), "/app");
});

test("cross-site mutations are rejected without blocking normal reads", () => {
  assert.equal(isCrossSiteMutation(request("POST", { "sec-fetch-site": "cross-site" })), true);
  assert.equal(isCrossSiteMutation(request("POST", { "sec-fetch-site": "same-origin" })), false);
  assert.equal(isCrossSiteMutation(request("GET", { "sec-fetch-site": "cross-site" })), false);
});

test("payload, list, and coordinate validation is bounded", () => {
  assert.equal(payloadTooLarge(request("POST", { "content-length": "70000" })), true);
  assert.deepEqual(cleanStringList([" cafe ", "cafe", "night"], { maxItems: 2 }), ["cafe", "night"]);
  assert.equal(validCoordinates(24.45, 54.37), true);
  assert.equal(validCoordinates(124.45, 54.37), false);
});


