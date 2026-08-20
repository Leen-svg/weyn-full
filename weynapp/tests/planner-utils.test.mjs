import test from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, haversineKm, orderStops } from "../lib/planner-utils.mjs";

test("haversine returns a plausible Abu Dhabi distance", () => {
  const km = haversineKm({ latitude: 24.4539, longitude: 54.3773 }, { latitude: 24.4992, longitude: 54.3877 });
  assert.ok(km > 4 && km < 7);
});

test("fallback ordering chooses the nearest next stop", () => {
  const a = { id: "a", latitude: 24.45, longitude: 54.37 };
  const far = { id: "far", latitude: 25.2, longitude: 55.2 };
  const near = { id: "near", latitude: 24.46, longitude: 54.38 };
  assert.deepEqual(orderStops([a, far, near]).map((x) => x.id), ["a", "near", "far"]);
});

test("timeline includes arrival and drive estimates", () => {
  const rows = buildTimeline([
    { id: "a", latitude: 24.45, longitude: 54.37 },
    { id: "b", latitude: 24.46, longitude: 54.38 },
  ], "09:30");
  assert.equal(rows[0].arrival, "09:30");
  assert.ok(rows[0].travelToNext >= 5);
  assert.match(rows[1].arrival, /^\d{2}:\d{2}$/);
});
