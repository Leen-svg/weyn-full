function finiteCoordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function venueDestination(venue = {}) {
  const latitude = finiteCoordinate(venue.latitude, -90, 90);
  const longitude = finiteCoordinate(venue.longitude, -180, 180);
  const label = [venue.name, venue.neighborhood, venue.city || "UAE"]
    .filter(Boolean)
    .join(", ");
  return { latitude, longitude, label: label || "UAE", hasCoordinates: latitude !== null && longitude !== null };
}

function urlWithParams(base, values) {
  const url = new URL(base);
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  return url.href;
}

export function providerLinks(venue) {
  const { latitude, longitude, label, hasCoordinates } = venueDestination(venue);
  const coordinates = hasCoordinates ? `${latitude},${longitude}` : null;
  return [
    {
      id: "apple",
      name: "Apple Maps",
      mark: "A",
      detail: "iPhone, iPad and Mac",
      href: urlWithParams("https://maps.apple.com/", { daddr: coordinates || label, q: label }),
    },
    {
      id: "google",
      name: "Google Maps",
      mark: "G",
      detail: "App or browser",
      href: urlWithParams("https://www.google.com/maps/dir/", { api: 1, destination: coordinates || label }),
    },
    {
      id: "waze",
      name: "Waze",
      mark: "W",
      detail: "Live driving directions",
      href: urlWithParams("https://www.waze.com/ul", hasCoordinates
        ? { ll: coordinates, navigate: "yes", utm_source: "weyn" }
        : { q: label, navigate: "yes", utm_source: "weyn" }),
    },
    {
      id: "here",
      name: "HERE WeGo",
      mark: "H",
      detail: "App or browser",
      href: hasCoordinates
        ? `https://wego.here.com/?map=${latitude},${longitude},16,normal&to=${encodeURIComponent(`${latitude},${longitude},${label}`)}`
        : `https://wego.here.com/search/${encodeURIComponent(label)}`,
    },
    {
      id: "bing",
      name: "Bing Maps",
      mark: "B",
      detail: "Browser directions",
      href: hasCoordinates
        ? urlWithParams("https://www.bing.com/maps", { rtp: `~pos.${latitude}_${longitude}_${label}`, lvl: 16 })
        : urlWithParams("https://www.bing.com/maps", { q: label }),
    },
    {
      id: "osm",
      name: "OpenStreetMap",
      mark: "O",
      detail: "Open map in browser",
      href: hasCoordinates
        ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
        : urlWithParams("https://www.openstreetmap.org/search", { query: label }),
    },
  ];
}

export function preferredMapHref(venue, userAgent = "") {
  const links = providerLinks(venue);
  return /iPhone|iPad|iPod|Macintosh/i.test(userAgent)
    ? links.find((provider) => provider.id === "apple").href
    : links.find((provider) => provider.id === "google").href;
}

