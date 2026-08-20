const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;

export function safeRelativePath(value, fallback = "/app") {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || CONTROL_OR_BACKSLASH.test(path)) return fallback;
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.startsWith("//") || CONTROL_OR_BACKSLASH.test(decoded)) return fallback;
  } catch {
    return fallback;
  }
  return path;
}

export function isCrossSiteMutation(req) {
  const method = String(req?.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  return req.headers?.get("sec-fetch-site") === "cross-site";
}

export function payloadTooLarge(req, maxBytes = 64 * 1024) {
  const value = Number(req.headers?.get("content-length"));
  return Number.isFinite(value) && value > maxBytes;
}

export function cleanStringList(value, { maxItems = 12, maxLength = 80 } = {}) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

export function validCoordinates(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

