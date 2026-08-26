// Only ever let http(s) URLs reach an href/src. Blocks javascript:, data:,
// and any other scheme a malicious venue_maps_url/avatar_url/photo_url
// value could carry, the classic stored-XSS vector for "URL" fields.
export function safeUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch {
    return null;
  }
  return null;
}

