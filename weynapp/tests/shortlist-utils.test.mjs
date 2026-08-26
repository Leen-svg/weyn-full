import test from "node:test";
import assert from "node:assert/strict";
import { mergeVenueResults, shortlistResultNote } from "../lib/shortlist-utils.mjs";

test("shortlist fallback preserves exact result order and removes duplicates", () => {
  const exact = [{ id: "a" }, { id: "b" }];
  const fallback = [{ id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(mergeVenueResults(exact, fallback, 3).map((venue) => venue.id), ["a", "b", "c"]);
});

test("shortlist note says which fixed filters stayed intact", () => {
  const note = shortlistResultNote({ total: 3, relaxedCount: 2, nearby: true });
  assert.match(note, /Near me distance/);
  assert.match(note, /city, budget, age and aesthetic/);
  assert.match(note, /2 remaining spots/);
});

test("shortlist note reports a genuine constrained partial result", () => {
  assert.match(shortlistResultNote({ total: 1 }), /Only 1 place/);
  assert.equal(shortlistResultNote({ total: 3 }), null);
});
