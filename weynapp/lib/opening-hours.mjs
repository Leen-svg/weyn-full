// Opening hours arrive in whatever shape the upstream tool exported, so this
// normalises the three we actually see rather than assuming one:
//
//   1. ["Monday: 9 AM–11 PM", ...]                     (flat list)
//   2. { weekdayDescriptions: [...] } / { weekday_text: [...] }  (Google)
//   3. { monday: "9 AM–11 PM", ... }                   (keyed map)
//
// Anything unrecognised returns an empty list rather than throwing, so a new
// export format degrades to "no hours shown" instead of breaking a venue card.

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function normalizeOpeningHours(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.filter((line) => typeof line === "string" && line.trim()).map((line) => line.trim());
  }

  if (typeof raw === "object") {
    const list = raw.weekdayDescriptions || raw.weekday_text || raw.weekdayText;
    if (Array.isArray(list)) return list.filter(Boolean).map(String);

    // Keyed map: rebuild in weekday order rather than object order.
    const keyed = DAYS.filter((d) => raw[d]).map((d) => {
      const label = d.charAt(0).toUpperCase() + d.slice(1);
      return `${label}: ${raw[d]}`;
    });
    if (keyed.length) return keyed;
  }

  return [];
}

// The line for today, so a card can show one row instead of seven.
// Gulf timezone: the venue's day, not the reader's.
export function hoursForToday(raw, now = new Date()) {
  const lines = normalizeOpeningHours(raw);
  if (!lines.length) return null;

  const dayName = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Dubai" });
  const match = lines.find((line) => line.toLowerCase().startsWith(dayName.toLowerCase()));
  if (!match) return lines.length === 7 ? null : lines[0];

  // Drop the "Monday: " prefix — the card already implies today.
  const colon = match.indexOf(":");
  return colon > -1 ? match.slice(colon + 1).trim() : match;
}
