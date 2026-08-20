export function coordinates(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
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
  if (!Number.isFinite(km)) return null;
  return Math.max(5, Math.round((km / 32) * 60 + 4));
}

export function buildTimeline(items, startTime = "10:00", stopMinutes = 75) {
  const [hours, minutes] = startTime.split(":").map(Number);
  let cursor = (Number.isFinite(hours) ? hours : 10) * 60 + (Number.isFinite(minutes) ? minutes : 0);
  return items.map((place, index) => {
    const arrival = `${String(Math.floor((cursor % 1440) / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`;
    const travelToNext = index < items.length - 1 ? estimatedDriveMinutes(place, items[index + 1]) : null;
    cursor += stopMinutes + (travelToNext || 0);
    return { ...place, arrival, travelToNext };
  });
}
