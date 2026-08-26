import test from "node:test";
import assert from "node:assert/strict";
import { extractFirstHttpUrl, extractPlaceDetails, isUaeLocation } from "../lib/place-import.mjs";

test("extracts a Google Maps place name, coordinates and UAE city", () => {
  const url = "https://www.google.com/maps/place/Hudson+%26+Rye/@25.2048,55.2708,15z";
  const result = extractPlaceDetails(url, url);
  assert.equal(result.name, "Hudson & Rye");
  assert.equal(result.city, "Dubai");
  assert.equal(result.latitude, 25.2048);
  assert.equal(result.longitude, 55.2708);
  assert.equal(isUaeLocation(result), true);
});

test("finds a map or social URL anywhere in a pasted chat message", () => {
  assert.equal(
    extractFirstHttpUrl("Try this tonight: https://maps.app.goo.gl/abc123 — looks good"),
    "https://maps.app.goo.gl/abc123",
  );
});

test("plain UAE place text remains importable without an AI key", () => {
  const result = extractPlaceDetails("Moon & Back, Jumeirah, Dubai");
  assert.equal(result.name, "Moon & Back, Jumeirah, Dubai");
  assert.equal(result.city, "Dubai");
});

test("non-UAE coordinates do not pass the UAE import guard", () => {
  const result = extractPlaceDetails("Somewhere", "https://www.google.com/maps/place/Somewhere/@51.5074,-0.1278,15z");
  assert.equal(isUaeLocation(result), false);
});

