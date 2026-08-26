import test from "node:test";
import assert from "node:assert/strict";
import { preferredMapHref, providerLinks, venueDestination } from "../lib/map-links.mjs";

const venue = { name: "Hudson & Rye", neighborhood: "Dubai", city: "Dubai", latitude: 25.2048, longitude: 55.2708 };

test("all map providers receive a usable web URL", () => {
  const providers = providerLinks(venue);
  assert.equal(providers.length, 6);
  for (const provider of providers) {
    const url = new URL(provider.href);
    assert.equal(url.protocol, "https:");
    assert.ok(url.hostname);
  }
  assert.match(providers.find((item) => item.id === "google").href, /destination=25\.2048%2C55\.2708/);
  assert.match(providers.find((item) => item.id === "waze").href, /ll=25\.2048%2C55\.2708/);
});

test("map links fall back to the place name when coordinates are missing", () => {
  const destination = venueDestination({ name: "Crafty Fox", city: "Abu Dhabi", latitude: null, longitude: "" });
  assert.equal(destination.hasCoordinates, false);
  const google = providerLinks({ name: "Crafty Fox", city: "Abu Dhabi" }).find((item) => item.id === "google");
  assert.match(google.href, /destination=Crafty\+Fox%2C\+Abu\+Dhabi/);
});

test("default provider is Apple on Apple devices and Google elsewhere", () => {
  assert.match(preferredMapHref(venue, "Mozilla/5.0 (iPhone)"), /maps\.apple\.com/);
  assert.match(preferredMapHref(venue, "Mozilla/5.0 (Linux; Android 15)"), /google\.com\/maps/);
});

