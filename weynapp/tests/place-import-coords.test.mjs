import test from "node:test";
import assert from "node:assert/strict";
import { extractPlaceDetails } from "../lib/place-import.mjs";

// Magic Import only understood Google's @lat,lng and !3d/!4d forms. Anything
// else — an Apple Maps link, a Weyn share link — fell through to geocoding by
// name, which is less accurate and costs a network round trip.
const AD = { lat: 24.4672, lng: 54.6031 };

function coordsFor(url) {
  const { latitude, longitude } = extractPlaceDetails("", url);
  return { latitude, longitude };
}

test("google maps @lat,lng still works", () => {
  assert.deepEqual(coordsFor(`https://www.google.com/maps/place/X/@${AD.lat},${AD.lng},17z`), { latitude: AD.lat, longitude: AD.lng });
});

test("google maps !3d/!4d still works", () => {
  assert.deepEqual(coordsFor(`https://www.google.com/maps/place/X/data=!3m1!4b1!3d${AD.lat}!4d${AD.lng}`), { latitude: AD.lat, longitude: AD.lng });
});

test("apple maps ll= is understood", () => {
  assert.deepEqual(coordsFor(`https://maps.apple.com/?q=Zeera&ll=${AD.lat},${AD.lng}`), { latitude: AD.lat, longitude: AD.lng });
});

test("google search-style query= is understood", () => {
  assert.deepEqual(coordsFor(`https://www.google.com/maps/search/?api=1&query=${AD.lat},${AD.lng}`), { latitude: AD.lat, longitude: AD.lng });
});

test("directions destination= and daddr= are understood", () => {
  assert.deepEqual(coordsFor(`https://www.google.com/maps/dir/?api=1&destination=${AD.lat},${AD.lng}`), { latitude: AD.lat, longitude: AD.lng });
  assert.deepEqual(coordsFor(`https://maps.apple.com/?daddr=${AD.lat},${AD.lng}`), { latitude: AD.lat, longitude: AD.lng });
});

test("a link with no coordinates yields nulls rather than guesses", () => {
  assert.deepEqual(coordsFor("https://www.instagram.com/p/abc123/"), { latitude: null, longitude: null });
});

test("out-of-range values are rejected, not clamped", () => {
  assert.deepEqual(coordsFor("https://maps.apple.com/?ll=99.5,200.4"), { latitude: null, longitude: null });
});
