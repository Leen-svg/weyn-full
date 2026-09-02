import test from "node:test";
import assert from "node:assert/strict";
import { dubaiTonightWindow, isTonightClubEvent, tonightClubEvents } from "../lib/event-tonight.mjs";

const linkedVenue = { id: "venue-one", name: "Test Club" };

test("tonight runs from 6 PM Dubai until 6 AM the next day", () => {
  const window = dubaiTonightWindow(new Date("2026-09-02T10:00:00Z"));
  assert.equal(window.start.toISOString(), "2026-09-02T14:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-03T02:00:00.000Z");
});

test("after midnight remains part of the previous Dubai night", () => {
  const window = dubaiTonightWindow(new Date("2026-09-02T22:30:00Z"));
  assert.equal(window.start.toISOString(), "2026-09-02T14:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-09-03T02:00:00.000Z");
});

test("Weyn Tonight only accepts linked club events in tonight's window", () => {
  const now = new Date("2026-09-02T10:00:00Z");
  assert.equal(isTonightClubEvent({ event_type: "club-night", next_start: "2026-09-02T20:00:00Z", venues: linkedVenue }, now), true);
  assert.equal(isTonightClubEvent({ event_type: "brunch", next_start: "2026-09-02T20:00:00Z", venues: linkedVenue }, now), false);
  assert.equal(isTonightClubEvent({ event_type: "club-night", next_start: "2026-09-02T20:00:00Z", venues: null }, now), false);
  assert.equal(tonightClubEvents([{ event_type: "party", next_start: "2026-09-03T01:00:00Z", venues: linkedVenue }], now).length, 1);
});
