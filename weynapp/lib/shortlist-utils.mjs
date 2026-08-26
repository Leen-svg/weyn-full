export function mergeVenueResults(exact = [], fallback = [], limit = 3) {
  const seen = new Set();
  const venues = [];

  for (const venue of [...exact, ...fallback]) {
    if (!venue?.id || seen.has(venue.id)) continue;
    seen.add(venue.id);
    venues.push(venue);
    if (venues.length >= limit) break;
  }

  return venues;
}

export function shortlistResultNote({ total = 0, relaxedCount = 0, nearby = false } = {}) {
  if (relaxedCount > 0) {
    const slots = relaxedCount === 1 ? "one remaining spot" : `${relaxedCount} remaining spots`;
    return `We kept your ${nearby ? "Near me distance, " : ""}city, budget, age and aesthetic choices, then filled ${slots} with the best available picks because fewer than three places matched your selected vibes.`;
  }

  if (total > 0 && total < 3) {
    return `Only ${total} ${total === 1 ? "place currently satisfies" : "places currently satisfy"} all of your fixed ${nearby ? "distance, " : ""}city, budget, age and aesthetic choices.`;
  }

  return null;
}
