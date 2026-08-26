const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

const CITY_PATTERNS = [
  { city: "Abu Dhabi", pattern: /\b(?:abu dhabi|yas island|saadiyat|al maryah|al reem|al bateen|khalifa city|masdar)\b/i },
  { city: "Dubai", pattern: /\b(?:dubai|jumeirah|downtown dubai|business bay|dubai marina|palm jumeirah|deira|al quoz)\b/i },
  { city: "Sharjah", pattern: /\bsharjah\b/i },
  { city: "Ajman", pattern: /\bajman\b/i },
  { city: "Fujairah", pattern: /\bfujairah\b/i },
  { city: "Ras Al Khaimah", pattern: /\b(?:ras al khaimah|rak)\b/i },
  { city: "Umm Al Quwain", pattern: /\b(?:umm al quwain|uaq)\b/i },
  { city: "Al Ain", pattern: /\bal ain\b/i },
];

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function decoded(value) {
  const plusFixed = decodeEntities(String(value || "").replace(/\+/g, " "));
  try { return decodeURIComponent(plusFixed); } catch { return plusFixed; }
}

function cleanName(value) {
  return decoded(value)
    .replace(URL_PATTERN, " ")
    .replace(/\s*[|·-]\s*(?:google maps|apple maps|instagram|tiktok).*$/i, "")
    .replace(/^\s*(?:meet at|go to|try|place|location)\s*[:–—-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "")
    .slice(0, 160);
}

function numericCoordinate(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function coordinatesFrom(value) {
  const text = decoded(value);
  const at = /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(text);
  const data = /!3d(-?\d{1,2}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/.exec(text);
  const pair = at || data;
  if (!pair) return { latitude: null, longitude: null };
  return {
    latitude: numericCoordinate(pair[1], -90, 90),
    longitude: numericCoordinate(pair[2], -180, 180),
  };
}

function cityFromCoordinates(latitude, longitude) {
  if (latitude === null || longitude === null || latitude < 22.5 || latitude > 26.5 || longitude < 51.4 || longitude > 56.7) return "";
  const centers = [
    { city: "Abu Dhabi", latitude: 24.4539, longitude: 54.3773 },
    { city: "Dubai", latitude: 25.2048, longitude: 55.2708 },
    { city: "Sharjah", latitude: 25.3463, longitude: 55.4209 },
    { city: "Al Ain", latitude: 24.1302, longitude: 55.8023 },
  ];
  return centers.reduce((nearest, center) => {
    const distance = (latitude - center.latitude) ** 2 + (longitude - center.longitude) ** 2;
    return distance < nearest.distance ? { city: center.city, distance } : nearest;
  }, { city: "Abu Dhabi", distance: Number.POSITIVE_INFINITY }).city;
}

function cityFromText(value) {
  return CITY_PATTERNS.find((item) => item.pattern.test(value))?.city || "";
}

function mapNameFromUrl(sourceUrl) {
  if (!sourceUrl) return "";
  let url;
  try { url = new URL(sourceUrl); } catch { return ""; }
  const path = decoded(url.pathname);
  const pathMatch = /\/maps\/(?:place|search)\/([^/]+)/i.exec(path);
  if (pathMatch) return cleanName(pathMatch[1]);
  for (const key of ["q", "query", "destination", "daddr"]) {
    const candidate = decoded(url.searchParams.get(key));
    if (candidate && !/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(candidate)) return cleanName(candidate);
  }
  return "";
}

export function extractFirstHttpUrl(value) {
  const match = URL_PATTERN.exec(String(value || ""));
  if (!match) return null;
  return match[0].replace(/[),.;!?]+$/, "");
}

export function extractPlaceDetails(context, sourceUrl = null) {
  const text = decodeEntities(String(context || "")).slice(0, 6000);
  const coordinates = coordinatesFrom(`${sourceUrl || ""}\n${text}`);
  const city = cityFromText(`${sourceUrl || ""}\n${text}`) || cityFromCoordinates(coordinates.latitude, coordinates.longitude);
  const mapName = mapNameFromUrl(sourceUrl);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(URL_PATTERN, " ").trim())
    .filter((line) => line && !/^(?:instagram|tiktok|google maps|apple maps)$/i.test(line));
  const textName = cleanName(lines[0] || "");
  return {
    name: mapName || textName,
    city,
    neighborhood: "",
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}

export function isUaeLocation({ city, latitude, longitude }, context = "") {
  if (cityFromText(`${city || ""} ${context || ""}`)) return true;
  return !!cityFromCoordinates(numericCoordinate(latitude, -90, 90), numericCoordinate(longitude, -180, 180));
}

