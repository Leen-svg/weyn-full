import { normalizeHttpUrl } from "./media-url.mjs";
import { extractInstagramPostUrl } from "./instagram-embed.mjs";

export const EVENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const AGES = new Set(["all-ages", "18-plus", "21-plus"]);
const TYPES = new Set(["party", "club-night", "live-music", "brunch", "ladies-night", "other"]);

const text = (value, max) => String(value || "").trim().slice(0, max) || null;
const raw = (value, max) => String(value || "").slice(0, max);
const url = (value) => value ? normalizeHttpUrl(String(value)) : null;
const date = (value) => DATE.test(String(value || "")) ? String(value) : null;
const time = (value) => TIME.test(String(value || "").slice(0, 5)) ? String(value).slice(0, 5) : null;
const days = (value) => [...new Set((Array.isArray(value) ? value : []).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();

function dubaiTimestamp(day, clock, nextDay = false) {
  const parsed = new Date(`${day}T00:00:00Z`);
  if (nextDay) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return `${parsed.toISOString().slice(0, 10)}T${clock || "00:00"}:00+04:00`;
}

function draftData(body) {
  return {
    title: raw(body.title, 160), description: raw(body.description, 1000), venueId: EVENT_UUID.test(body.venueId || "") ? body.venueId : "",
    city: body.city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai", location: raw(body.location, 180),
    startsOn: raw(body.startsOn, 10), endsOn: raw(body.endsOn, 10), startTime: raw(body.startTime, 5), endTime: raw(body.endTime, 5),
    recurrenceType: body.recurrenceType === "weekly" ? "weekly" : "one_time", recurrenceDays: days(body.recurrenceDays),
    ageRestriction: AGES.has(body.ageRestriction) ? body.ageRestriction : "21-plus", eventType: TYPES.has(body.eventType) ? body.eventType : "party",
    imageUrl: raw(body.imageUrl, 2000), ticketUrl: raw(body.ticketUrl, 2000), websiteUrl: raw(body.websiteUrl, 2000), socialUrl: raw(body.socialUrl, 2000),
    instagramEmbed: raw(body.instagramEmbed, 20000), reservationPhone: raw(body.reservationPhone, 40), priceFromAed: raw(body.priceFromAed, 12),
    sortOrder: Number.isInteger(body.sortOrder) && body.sortOrder >= 0 ? Math.min(body.sortOrder, 99999) : 0,
    isTrending: !!body.isTrending, isTryThisOut: !!body.isTryThisOut,
  };
}

export function eventValues(body) {
  const publishing = body.intent === "publish";
  const title = text(body.title, 160);
  const startsOn = date(body.startsOn);
  const recurrence = body.recurrenceType === "weekly" ? "weekly" : "none";
  const recurrenceDays = recurrence === "weekly" ? days(body.recurrenceDays) : [];
  const recurrenceUntil = recurrence === "weekly" ? date(body.endsOn) : null;
  const startTime = time(body.startTime);
  const endTime = time(body.endTime);

  if (publishing && !title) return { error: "Add an event name before publishing" };
  if (publishing && !startsOn) return { error: "Choose an event date before publishing" };
  if (publishing && recurrence === "weekly" && !recurrenceDays.length) return { error: "Choose at least one repeat day before publishing" };
  if (publishing && body.endsOn && recurrence === "weekly" && !recurrenceUntil) return { error: "Choose a valid repeat end date" };
  if (publishing && recurrenceUntil && recurrenceUntil < startsOn) return { error: "Repeat end date must be after the start date" };
  if (publishing) {
    for (const [label, value] of [["image", body.imageUrl], ["booking", body.ticketUrl], ["website", body.websiteUrl], ["social media", body.socialUrl]]) {
      if (value && !url(value)) return { error: `Use a valid HTTPS ${label} link` };
    }
  }

  const phone = text(body.reservationPhone, 40);
  const validPhone = phone && /^[+\d][\d\s().-]{4,39}$/.test(phone) ? phone : null;
  if (publishing && phone && !validPhone) return { error: "Use a valid reservation phone number" };
  if (publishing && body.startTime && !startTime) return { error: "Choose a valid start time" };
  if (publishing && body.endTime && !endTime) return { error: "Choose a valid end time" };
  const instagramPostUrl = body.instagramEmbed ? extractInstagramPostUrl(String(body.instagramEmbed).slice(0, 20000)) : null;
  if (publishing && body.instagramEmbed && !instagramPostUrl) return { error: "Paste a valid public Instagram post, reel, carousel link, or embed code" };
  const priceText = String(body.priceFromAed ?? "").trim();
  const price = priceText ? Number(priceText) : NaN;

  return { values: {
    title, description: text(body.description, 1000), venue_id: EVENT_UUID.test(body.venueId || "") ? body.venueId : null,
    city: body.city === "Abu Dhabi" ? "Abu Dhabi" : "Dubai", neighborhood: text(body.location, 180),
    starts_at: startsOn ? dubaiTimestamp(startsOn, startTime) : null,
    ends_at: startsOn && endTime ? dubaiTimestamp(startsOn, endTime, !!(startTime && endTime < startTime)) : null,
    recurrence, recurrence_until: recurrenceUntil, recurrence_days: recurrenceDays,
    age_restriction: AGES.has(body.ageRestriction) ? body.ageRestriction : "21-plus",
    event_type: TYPES.has(body.eventType) ? body.eventType : "party",
    cover_image_url: url(body.imageUrl), ticket_url: url(body.ticketUrl), website_url: url(body.websiteUrl), social_url: url(body.socialUrl),
    instagram_post_url: instagramPostUrl, reservation_phone: validPhone,
    price_from_aed: Number.isFinite(price) && price >= 0 ? Math.min(100000, Math.round(price)) : null,
    sort_order: Number.isInteger(body.sortOrder) && body.sortOrder >= 0 ? Math.min(body.sortOrder, 99999) : 0,
    is_trending: !!body.isTrending, is_try_this_out: !!body.isTryThisOut,
    is_active: publishing, draft_data: publishing ? {} : draftData(body),
  } };
}
