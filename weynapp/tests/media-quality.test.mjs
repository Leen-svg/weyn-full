import test from "node:test";
import assert from "node:assert/strict";
import { assessImageQuality } from "../lib/media-quality.mjs";

test("standard quality keeps normal mobile and landscape images", () => {
  assert.equal(assessImageQuality({ width: 1280, height: 720 }).flagged, false);
  assert.equal(assessImageQuality({ width: 720, height: 1280 }).flagged, false);
  assert.equal(assessImageQuality({ width: 800, height: 800 }).flagged, false);
});

test("standard quality flags genuinely small images", () => {
  const result = assessImageQuality({ width: 600, height: 600 });
  assert.equal(result.flagged, true);
  assert.ok(result.reasons.some((reason) => reason.includes("MP")));
});

test("strict quality catches images that pass the standard preset", () => {
  assert.equal(assessImageQuality({ width: 1000, height: 700 }, "standard").flagged, false);
  assert.equal(assessImageQuality({ width: 1000, height: 700 }, "strict").flagged, true);
});

test("broken images are always flagged", () => {
  const result = assessImageQuality({ width: 0, height: 0, loaded: false });
  assert.deepEqual(result, { flagged: true, reasons: ["Image is broken or unavailable"] });
});

