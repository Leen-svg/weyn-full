import test from "node:test";
import assert from "node:assert/strict";
import { eventValues } from "../lib/admin-event-values.mjs";

test("an incomplete event can be saved as a draft", () => {
  const result = eventValues({ intent: "draft", title: "", startsOn: "", startTime: "22:00", websiteUrl: "not finished", recurrenceType: "weekly" });
  assert.equal(result.error, undefined);
  assert.equal(result.values.is_active, false);
  assert.equal(result.values.starts_at, null);
  assert.equal(result.values.draft_data.startTime, "22:00");
  assert.equal(result.values.draft_data.websiteUrl, "not finished");
});

test("publishing requires a name and date", () => {
  assert.match(eventValues({ intent: "publish" }).error, /name/);
  assert.match(eventValues({ intent: "publish", title: "Friday Night" }).error, /date/);
});

test("a complete event publishes and clears draft data", () => {
  const result = eventValues({ intent: "publish", title: "Friday Night", startsOn: "2026-09-04", startTime: "22:00", recurrenceType: "one_time" });
  assert.equal(result.values.is_active, true);
  assert.equal(result.values.starts_at, "2026-09-04T22:00:00+04:00");
  assert.deepEqual(result.values.draft_data, {});
});
