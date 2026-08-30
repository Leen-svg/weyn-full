import test from "node:test";
import assert from "node:assert/strict";
import { venueSharePath, venueShareUrl } from "../lib/venue-share.mjs";

test("venue share links always return people to Weyn", () => {
  const id = "8bafbb8a-103b-4b62-96bd-39e10a2cb043";
  assert.equal(venueSharePath(id), `/v/${id}`);
  assert.equal(venueShareUrl("https://goweyn.com/", id), `https://goweyn.com/v/${id}`);
});

test("venue sharing never falls back to a Google Maps URL", () => {
  const url = venueShareUrl("https://goweyn.com", "venue-id");
  assert.match(url, /^https:\/\/goweyn\.com\/v\//);
  assert.doesNotMatch(url, /google|maps/i);
});
