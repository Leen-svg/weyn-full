export function venueSharePath(venueId) {
  if (!venueId || typeof venueId !== "string") return "/app";
  return `/v/${encodeURIComponent(venueId)}`;
}

export function venueShareUrl(origin, venueId) {
  const safeOrigin = typeof origin === "string" ? origin.replace(/\/+$/, "") : "";
  return `${safeOrigin}${venueSharePath(venueId)}`;
}
