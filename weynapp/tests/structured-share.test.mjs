import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStructuredShare, structuredSharePath } from "../lib/structured-share.mjs";

const id = "123e4567-e89b-42d3-a456-426614174000";

test("only typed Weyn resources with UUID ids are accepted", () => {
  assert.deepEqual(normalizeStructuredShare({ type: "venue", id }), { type: "venue", id });
  assert.deepEqual(normalizeStructuredShare({ type: "poll", id }), { type: "poll", id });
  assert.equal(normalizeStructuredShare({ type: "url", id }), null);
  assert.equal(normalizeStructuredShare({ type: "venue", id: "https://evil.example" }), null);
});

test("structured links stay on Weyn-owned relative paths", () => {
  assert.equal(structuredSharePath({ type: "venue", id }), `/app?venue=${id}`);
  assert.equal(structuredSharePath({ type: "saved_list", id }), `/lists/${id}`);
});
