export const VISIBILITIES = Object.freeze(["private", "friends", "public"]);

export function isVisibility(value) {
  return VISIBILITIES.includes(value);
}

export function normalizeVisibility(value, fallback = "private") {
  return VISIBILITIES.includes(value) ? value : (VISIBILITIES.includes(fallback) ? fallback : "private");
}

export function canViewVisibility({ viewerId, ownerId, visibility, isFriend = false }) {
  if (viewerId && ownerId && viewerId === ownerId) return true;
  const scope = normalizeVisibility(visibility);
  if (scope === "public") return true;
  return scope === "friends" && Boolean(viewerId && isFriend);
}
