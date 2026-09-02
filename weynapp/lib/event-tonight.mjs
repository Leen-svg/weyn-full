const CLUB_EVENT_TYPES = new Set(["club-night", "party", "live-music", "ladies-night"]);

function dubaiParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function shiftDate(date, days) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function dubaiTonightWindow(now = new Date()) {
  const parts = dubaiParts(now);
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const beforeSix = Number(parts.hour) < 6;
  const startDate = beforeSix ? shiftDate(today, -1) : today;
  const endDate = beforeSix ? today : shiftDate(today, 1);
  return {
    start: new Date(`${startDate}T18:00:00+04:00`),
    end: new Date(`${endDate}T06:00:00+04:00`),
  };
}

export function isTonightClubEvent(event, now = new Date()) {
  if (!event?.venues?.id || !CLUB_EVENT_TYPES.has(event.event_type)) return false;
  const occurrence = new Date(event.next_start || event.starts_at);
  if (Number.isNaN(occurrence.getTime())) return false;
  const { start, end } = dubaiTonightWindow(now);
  return occurrence >= start && occurrence < end;
}

export function tonightClubEvents(events, now = new Date(), limit = 12) {
  return (events || []).filter((event) => isTonightClubEvent(event, now)).slice(0, limit);
}
