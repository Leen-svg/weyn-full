// Feature flags for the 90-day subtraction pass.
//
// The strategy doc is explicit that these surfaces are *hidden, not deleted* —
// the routes, tables and components all still work, they just stop being
// default navigation. Flip a flag back to true to restore one; demand has to
// re-open the case, not a rewrite.
//
// Set the matching env var to "on" to re-enable without a deploy-time edit,
// e.g. NEXT_PUBLIC_FEATURE_GROUPS=on
//
// Reasons, from the roadmap's feature-posture table:
//   groups      HIDE   "not primary nav. Product must work solo."
//   communityFeed HIDE "empty social is a trust tax" — 0 posts today
//   points      FREEZE "gamifying low-value actions is a tarpit"
//   ghostMode   FREEZE shipped as identity, not utility
//   friends     HIDE   until local density exists
//   publicProfiles HIDE same
//   creators    DEFER  "not an Instagram clone"

const on = (name, fallback) => {
  const raw = process.env[`NEXT_PUBLIC_FEATURE_${name}`];
  if (raw === "on") return true;
  if (raw === "off") return false;
  return fallback;
};

export const FEATURES = {
  groups: on("GROUPS", false),
  communityFeed: on("COMMUNITY_FEED", false),
  points: on("POINTS", false),
  ghostMode: on("GHOST_MODE", false),
  friends: on("FRIENDS", false),
  publicProfiles: on("PUBLIC_PROFILES", false),
  creators: on("CREATORS", false),

  // Kept on: these are the product.
  nightlife21Plus: on("NIGHTLIFE", true),
  magicImport: on("MAGIC_IMPORT", true),
  guestVote: on("GUEST_VOTE", true),
};
