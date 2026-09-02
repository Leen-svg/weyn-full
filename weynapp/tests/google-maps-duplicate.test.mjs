import test from "node:test";
import assert from "node:assert/strict";
import { duplicateGoogleMapsVenue, googleMapsPlaceKey, groupDuplicateGoogleMapsVenues } from "../lib/google-maps-duplicate.mjs";

test("recognizes a Google Place ID across URL shapes", () => {
  assert.equal(googleMapsPlaceKey("https://www.google.com/maps/place/Test/data=!4m2!3m1!1sChIJabc_123456789?entry=ttu"), googleMapsPlaceKey("https://maps.google.com/maps?q=place_id:ChIJabc_123456789&utm_source=test"));
});
test("normalizes exact short links and tracking differences", () => {
  assert.equal(googleMapsPlaceKey("https://maps.app.goo.gl/AbC123/?entry=ttu#share"), googleMapsPlaceKey("https://maps.app.goo.gl/AbC123"));
});
test("finds a duplicate while allowing the venue being edited", () => {
  const venues = [{ id: "one", name: "Existing", google_maps_url: "https://maps.app.goo.gl/AbC123" }];
  assert.equal(duplicateGoogleMapsVenue(venues, "https://maps.app.goo.gl/AbC123/")?.name, "Existing");
  assert.equal(duplicateGoogleMapsVenue(venues, "https://maps.app.goo.gl/AbC123", "one"), null);
});
test("groups existing catalog duplicates", () => {
  const venues = [{ id: "one", name: "First", google_maps_url: "https://maps.app.goo.gl/Same" }, { id: "two", name: "Second", google_maps_url: "https://maps.app.goo.gl/Same/?entry=ttu" }];
  assert.equal(groupDuplicateGoogleMapsVenues(venues)[0].length, 2);
});
