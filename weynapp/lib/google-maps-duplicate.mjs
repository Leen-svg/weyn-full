const GOOGLE_MAP_HOST = /(^|\.)(google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl)$/i;
const IGNORED_QUERY_PARAMS = new Set(["entry", "g_ep", "hl", "authuser", "utm_source", "utm_medium", "utm_campaign"]);

export function googleMapsPlaceKey(value) {
  if (!value || typeof value !== "string") return null;
  let parsed;
  try { parsed = new URL(value.trim()); } catch { return null; }
  if (!["http:", "https:"].includes(parsed.protocol) || !GOOGLE_MAP_HOST.test(parsed.hostname)) return null;
  const decoded = decodeURIComponent(`${parsed.pathname}${parsed.search}`);
  const placeId = decoded.match(/(?:place_id:|query_place_id=|[?!&]q=)(ChI[A-Za-z0-9_-]+)/i)?.[1]
    || decoded.match(/(?:^|[!/])1s(ChI[A-Za-z0-9_-]+)/i)?.[1]
    || decoded.match(/\b(ChI[A-Za-z0-9_-]{12,})\b/i)?.[1];
  if (placeId) return `place-id:${placeId.toLowerCase()}`;
  const hostname = parsed.hostname.toLowerCase().replace(/^maps\.google\./, "www.google.");
  const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  const params = [...parsed.searchParams.entries()].filter(([key]) => !IGNORED_QUERY_PARAMS.has(key.toLowerCase()) && !key.toLowerCase().startsWith("utm_")).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const query = new URLSearchParams(params).toString();
  return `url:${hostname}${pathname}${query ? `?${query}` : ""}`;
}

export function duplicateGoogleMapsVenue(venues, mapsUrl, excludeId = null) {
  const key = googleMapsPlaceKey(mapsUrl);
  if (!key) return null;
  return (venues || []).find((venue) => venue.id !== excludeId && googleMapsPlaceKey(venue.google_maps_url) === key) || null;
}

export function groupDuplicateGoogleMapsVenues(venues) {
  const grouped = new Map();
  for (const venue of venues || []) {
    const key = googleMapsPlaceKey(venue.google_maps_url);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) || []), venue]);
  }
  return [...grouped.values()].filter((group) => group.length > 1);
}
