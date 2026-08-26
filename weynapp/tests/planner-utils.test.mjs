import test from "node:test";
import assert from "node:assert/strict";
import { buildTimeline, coordinates, estimatedDriveMinutes, formatClockMinutes, haversineKm, orderStops } from "../lib/planner-utils.mjs";

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
  assert.equal(rows[0].arrival, "9:30 AM");
  assert.ok(rows[0].travelToNext >= 5);
  assert.match(rows[1].arrival, /^\d{1,2}:\d{2} [AP]M$/);
});

test("blank and null coordinates are not coerced to the Gulf of Guinea", () => {
  assert.equal(coordinates({ latitude: null, longitude: null }), null);
  assert.equal(coordinates({ latitude: "", longitude: "" }), null);
  assert.equal(coordinates({ latitude: 0, longitude: 0 }), null);
  assert.equal(estimatedDriveMinutes(
    { latitude: null, longitude: null },
    { latitude: 25.2048, longitude: 55.2708 },
  ), null);
});

test("implausibly long UAE day-plan legs are hidden instead of showing thousands of minutes", () => {
  assert.equal(estimatedDriveMinutes(
    { latitude: 24.4539, longitude: 54.3773 },
    { latitude: 0.1, longitude: 0.1 },
  ), null);
});

test("clock labels always include an unambiguous AM or PM", () => {
  assert.equal(formatClockMinutes(10 * 60), "10:00 AM");
  assert.equal(formatClockMinutes(12 * 60), "12:00 PM");
  assert.equal(formatClockMinutes(24 * 60), "12:00 AM");
});
