import test from "node:test";
import assert from "node:assert/strict";
import { interpretAskWeyn } from "../lib/ask-weyn.mjs";

// The live taxonomy: 32 vibe tags across 7 categories. Ask Weyn's intent
// vocabulary must resolve against THESE, not invented names — that mismatch is
// what made it answer "try a little more detail" to almost everything.
const GROUPS = [
  { slug: "access-rules", max_select: 3, tags: [
    { slug: "all-ages-welcome", display_name: "All Ages Welcome" },
    { slug: "dry-unlicensed", display_name: "Dry / Unlicensed" },
    { slug: "licensed-serves-alcohol", display_name: "Licensed (Serves Alcohol)" },
    { slug: "shisha-served", display_name: "Shisha Served" },
    { slug: "strictly-21plus", display_name: "Strictly 21+" },
  ] },
  { slug: "climate-seating", max_select: 3, tags: [
    { slug: "ac-cooled-outdoor-terrace", display_name: "AC-Cooled Outdoor Terrace" },
    { slug: "indoor-only", display_name: "Indoor Only" },
    { slug: "sea-marina-view", display_name: "Sea / Marina View" },
  ] },
  { slug: "dietary-lifestyle", max_select: 3, tags: [
    { slug: "laptop-work-friendly", display_name: "Laptop / Work Friendly" },
    { slug: "late-night-dining", display_name: "Late Night Dining" },
    { slug: "pet-friendly", display_name: "Pet Friendly" },
  ] },
  { slug: "logistics", max_select: 3, tags: [
    { slug: "free-valet-dedicated-parking", display_name: "Free Valet / Dedicated Parking" },
    { slug: "paid-difficult-parking", display_name: "Paid / Difficult Parking" },
    { slug: "reservation-essential", display_name: "Reservation Essential" },
    { slug: "walk-ins-welcome", display_name: "Walk-ins Welcome" },
  ] },
  { slug: "occasion", max_select: 3, tags: [
    { slug: "big-group-celebration", display_name: "Big Group / Celebration" },
    { slug: "business-impress-a-client", display_name: "Business / Impress a Client" },
    { slug: "date-night", display_name: "Date Night" },
    { slug: "late-night-bites", display_name: "Late Night Bites" },
    { slug: "quick-catchup", display_name: "Quick Catchup" },
    { slug: "solo-escape", display_name: "Solo Escape" },
    { slug: "weekend-sundowners", display_name: "Weekend Sundowners" },
  ] },
  { slug: "substance-value", max_select: 3, tags: [
    { slug: "do-it-for-the-gram", display_name: "Do it for the Gram" },
    { slug: "foodie-approved", display_name: "Foodie Approved" },
    { slug: "generous-portions", display_name: "Generous Portions" },
    { slug: "hidden-gem", display_name: "Hidden Gem" },
    { slug: "tourist-staple", display_name: "Tourist Staple" },
  ] },
  { slug: "vibe-noise", max_select: 3, tags: [
    { slug: "aesthetic-instagrammable", display_name: "Aesthetic / Instagrammable" },
    { slug: "conversation-friendly", display_name: "Conversation Friendly" },
    { slug: "cozy-and-casual", display_name: "Cozy & Casual" },
    { slug: "dark-and-moody", display_name: "Dark & Moody" },
    { slug: "loud-and-theatrical", display_name: "Loud & Theatrical" },
  ] },
];

const ask = (q) => interpretAskWeyn(q, GROUPS, { city: "Abu Dhabi", maxSpend: 99999, maxAge: 0, aestheticOnly: false });

test("every intent trigger resolves to a tag that exists in the taxonomy", () => {
  const valid = new Set(GROUPS.flatMap((g) => g.tags.map((t) => t.slug)));
  const phrases = [
    "quiet spot", "cozy place", "dark and moody bar", "somewhere lively",
    "aesthetic cafe", "date night", "birthday dinner", "business lunch",
    "solo escape", "quick catchup", "sunset drinks", "late night food",
    "good food", "big portions", "hidden gem", "touristy spot",
    "outdoor terrace", "indoor and air conditioned", "sea view",
    "cocktails", "no alcohol", "shisha", "family with kids", "adults only",
    "walk in", "reservation", "valet parking", "laptop work", "dog friendly",
  ];
  for (const p of phrases) {
    const r = ask(p);
    assert.ok(r.tags.length > 0, `"${p}" resolved to no tags`);
    for (const slug of r.tags) {
      assert.ok(valid.has(slug), `"${p}" produced unknown tag "${slug}"`);
    }
  }
});

test("a full natural sentence resolves several intents at once", () => {
  const r = ask("quiet rooftop date in Dubai under 150 AED");
  assert.ok(r.tags.includes("date-night"), "expected date-night");
  assert.ok(r.tags.includes("sea-marina-view"), "expected sea-marina-view for rooftop/view");
  assert.ok(r.tags.includes("conversation-friendly"), "expected conversation-friendly for quiet");
});

test("selected groups only contain slugs from their own category", () => {
  const r = ask("cozy date night with cocktails outdoors");
  for (const [groupSlug, slugs] of Object.entries(r.selected)) {
    const group = GROUPS.find((g) => g.slug === groupSlug);
    assert.ok(group, `unknown group ${groupSlug}`);
    const own = new Set(group.tags.map((t) => t.slug));
    for (const s of slugs) assert.ok(own.has(s), `${s} is not in ${groupSlug}`);
  }
});

test("gibberish still returns nothing so the UI can prompt for detail", () => {
  assert.equal(ask("zzzzqqq").tags.length, 0);
});
