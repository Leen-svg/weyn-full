import { normalizeHttpUrl } from "@/lib/media-url.mjs";

const TYPE_LABELS = {
  party: "Party",
  "club-night": "Club night",
  "live-music": "Live music",
  brunch: "Brunch",
  "ladies-night": "Ladies' night",
  other: "Event",
};

// Dubai/Abu Dhabi are both UTC+4 and do not observe DST, so a fixed offset is
// correct here and avoids the server rendering a different day than the phone.
const GULF_TZ = "Asia/Dubai";

function formatWhen(startsAt) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: GULF_TZ });
  const time = start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: GULF_TZ });
  return `${day} · ${time}`;
}

export default function EventCard({ event }) {
  const cover = normalizeHttpUrl(event.cover_image_url);
  const ticket = normalizeHttpUrl(event.ticket_url);
  const when = formatWhen(event.starts_at);
  const place = event.venues?.name || event.neighborhood || event.city;
  const ageLabel = event.age_restriction === "21-plus" ? "21+" : event.age_restriction === "18-plus" ? "18+" : null;

  return (
    <article className="event-card">
      <div
        className="event-card__cover"
        style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
        aria-hidden="true"
      >
        {ageLabel && <span className="event-card__age">{ageLabel}</span>}
      </div>
      <div className="event-card__body">
        <span className="event-card__type">{TYPE_LABELS[event.event_type] || TYPE_LABELS.other}</span>
        <h4 className="event-card__title">{event.title}</h4>
        {when && <p className="event-card__when">{when}</p>}
        {place && <p className="event-card__where">{place}</p>}
        {event.price_from_aed ? (
          <p className="event-card__price">From {event.price_from_aed} AED</p>
        ) : null}
        {ticket && (
          <a className="btn small" href={ticket} target="_blank" rel="noopener noreferrer">
            Tickets
          </a>
        )}
      </div>
    </article>
  );
}
