export function coordinates(place) {
  const rawLatitude = place?.latitude;
  const rawLongitude = place?.longitude;
  if (
    rawLatitude === null || rawLatitude === undefined || String(rawLatitude).trim() === "" ||
    rawLongitude === null || rawLongitude === undefined || String(rawLongitude).trim() === ""
  ) return null;

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
    (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001)
  ) return null;
  return [latitude, longitude];
}

export function haversineKm(a, b) {
  const left = coordinates(a);
  const right = coordinates(b);
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(right[0] - left[0]);
  const dLon = rad(right[1] - left[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(left[0])) * Math.cos(rad(right[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function orderStops(items) {
  if (items.length < 2) return [...items];
  const remaining = [...items];
  const ordered = [remaining.shift()];
  while (remaining.length) {
    let closest = 0;
    for (let i = 1; i < remaining.length; i += 1) {
      if (haversineKm(ordered.at(-1), remaining[i]) < haversineKm(ordered.at(-1), remaining[closest])) closest = i;
    }
    ordered.push(remaining.splice(closest, 1)[0]);
  }
  return ordered;
}

export function estimatedDriveMinutes(a, b) {
  const km = haversineKm(a, b);
  // Weyn currently plans days inside the UAE. Distances above 300 km almost
  // always mean a missing coordinate was previously coerced to 0,0 or an
  // imported place was geocoded in the wrong country. Do not show a wildly
  // misleading multi-day drive estimate in either case.
  if (!Number.isFinite(km) || km > 300) return null;
  return Math.max(5, Math.min(240, Math.round((km / 38) * 60 + 6)));
}

export function formatClockMinutes(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${hours24 < 12 ? "AM" : "PM"}`;
}

export function buildTimeline(items, startTime = "10:00", stopMinutes = 75) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(startTime || ""));
  const hours = match ? Number(match[1]) : 10;
  const minutes = match ? Number(match[2]) : 0;
  let cursor = (hours >= 0 && hours <= 23 ? hours : 10) * 60 + (minutes >= 0 && minutes <= 59 ? minutes : 0);
  const dwell = Number.isFinite(Number(stopMinutes)) ? Math.max(15, Math.min(360, Number(stopMinutes))) : 75;
  return items.map((place, index) => {
    const arrival = formatClockMinutes(cursor);
    const travelToNext = index < items.length - 1 ? estimatedDriveMinutes(place, items[index + 1]) : null;
    cursor += dwell + (travelToNext || 0);
    return { ...place, arrival, travelToNext };
  });
}
