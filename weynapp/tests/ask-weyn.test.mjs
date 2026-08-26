import test from "node:test";
import assert from "node:assert/strict";
import { interpretAskWeyn } from "../lib/ask-weyn.mjs";

const groups = [
  {
    slug: "occasion",
    max_select: 2,
    tags: [
      { slug: "date-night", display_name: "Date Night" },
      { slug: "foodie-approved", display_name: "Foodie Approved" },
    ],
  },
  {
    slug: "setting",
    max_select: 3,
    tags: [
      { slug: "quiet", display_name: "Quiet & Intimate" },
      { slug: "rooftop", display_name: "Rooftop Views" },
      { slug: "aesthetic-focused", display_name: "Aesthetic Focused" },
    ],
  },
];

test("Ask Weyn turns a natural-language request into shortlist filters", () => {
  const parsed = interpretAskWeyn("quiet rooftop date in Dubai under 150 AED", groups);
  assert.equal(parsed.city, "Dubai");
  assert.equal(parsed.maxSpend, 150);
  assert.deepEqual(parsed.selected.occasion, ["date-night"]);
  assert.deepEqual(new Set(parsed.selected.setting), new Set(["quiet", "rooftop"]));
});

test("Ask Weyn understands affordable and aesthetic intent", () => {
  const parsed = interpretAskWeyn("a cheap aesthetic place in AD", groups);
  assert.equal(parsed.city, "Abu Dhabi");
  assert.equal(parsed.maxSpend, 100);
  assert.equal(parsed.aestheticOnly, true);
  assert.ok(parsed.tags.includes("aesthetic-focused"));
});
