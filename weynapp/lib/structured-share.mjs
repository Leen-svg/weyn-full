const TYPES = new Set(["venue", "saved_list", "trip_board", "poll"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeStructuredShare(value) {
  if (!value || typeof value !== "object") return null;
  const type = String(value.type || "").trim();
  const id = String(value.id || "").trim();
  if (!TYPES.has(type) || !UUID.test(id)) return null;
  return { type, id };
}

export function structuredSharePath(share) {
  const normalized = normalizeStructuredShare(share);
  if (!normalized) return null;
  if (normalized.type === "venue") return `/app?venue=${encodeURIComponent(normalized.id)}`;
  if (normalized.type === "saved_list") return `/lists/${encodeURIComponent(normalized.id)}`;
  if (normalized.type === "poll") return `/p/${encodeURIComponent(normalized.id)}`;
  return `/b/${encodeURIComponent(normalized.id)}`;
}
