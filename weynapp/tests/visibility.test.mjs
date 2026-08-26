import test from "node:test";
import assert from "node:assert/strict";
import { canViewVisibility, normalizeVisibility, VISIBILITIES } from "../lib/visibility.mjs";

test("visibility values are the single supported audience set", () => {
  assert.deepEqual(VISIBILITIES, ["private", "friends", "public"]);
  assert.equal(normalizeVisibility("unexpected"), "private");
});

test("private stays owner-only and friends requires an accepted friend", () => {
  assert.equal(canViewVisibility({ viewerId: "owner", ownerId: "owner", visibility: "private" }), true);
  assert.equal(canViewVisibility({ viewerId: "other", ownerId: "owner", visibility: "private", isFriend: true }), false);
  assert.equal(canViewVisibility({ viewerId: "friend", ownerId: "owner", visibility: "friends", isFriend: true }), true);
  assert.equal(canViewVisibility({ viewerId: "stranger", ownerId: "owner", visibility: "friends" }), false);
  assert.equal(canViewVisibility({ visibility: "public" }), true);
});

