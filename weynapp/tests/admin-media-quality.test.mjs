import test from "node:test";
import assert from "node:assert/strict";
import { readApiJson, splitIntoBatches } from "../lib/admin-media-quality.mjs";

test("large media selections are split below the API safety limit", () => {
  const ids = Array.from({ length: 418 }, (_, index) => `image-${index}`);
  const batches = splitIntoBatches(ids);

  assert.deepEqual(batches.map((batch) => batch.length), [200, 200, 18]);
  assert.deepEqual(batches.flat(), ids);
});

test("JSON API errors keep their useful message", async () => {
  const response = new Response(JSON.stringify({ error: "Remove at most 250 images at once" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(() => readApiJson(response, "Removal failed"), /Remove at most 250 images at once/);
});

test("HTML API errors become a readable message instead of a JSON parse error", async () => {
  const response = new Response("<!DOCTYPE html><title>Bad gateway</title>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  });

  await assert.rejects(
    () => readApiJson(response, "Removal failed"),
    /Removal failed\. The server returned an unexpected response \(502\)/,
  );
});
