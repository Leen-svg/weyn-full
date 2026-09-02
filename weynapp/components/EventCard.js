"use client";
import Link from "next/link";
import { useState } from "react";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";

const TYPE_LABELS = { party: "Party", "club-night": "Club night", "live-music": "Live music", brunch: "Brunch", "ladies-night": "Ladies' night", other: "Event" };
const GULF_TZ = "Asia/Dubai";

function formatWhen(startsAt) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: GULF_TZ });
  const time = start.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: GULF_TZ });
  return `${day} · ${time}`;
}

export default function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  const cover = normalizeHttpUrl(event.cover_image_url);
  const ticket = normalizeHttpUrl(event.ticket_url);
  const website = normalizeHttpUrl(event.website_url);
  const social = normalizeHttpUrl(event.social_url);
  const when = formatWhen(event.next_start || event.starts_at);
  const isWeekly = event.recurrence === "weekly";
  const venue = event.venues || null;
  const place = venue?.name || event.neighborhood || event.city;
  const ageLabel = event.age_restriction === "21-plus" ? "21+" : event.age_restriction === "18-plus" ? "18+" : null;

  function toggleFromCard(eventClick) {
    if (eventClick.target.closest("a,button")) return;
    setExpanded((value) => !value);
  }

  return (
    <article className={`event-card ${expanded ? "is-expanded" : ""}`} data-expanded={expanded} onClick={toggleFromCard}>
      <div className="event-card__cover" style={cover ? { backgroundImage: `url("${cover}")` } : undefined} aria-hidden="true">
        <div className="event-badges">
          {event.is_trending && <span className="event-badge event-badge--trending">🔥 Trending</span>}
          {event.is_try_this_out && <span className="event-badge event-badge--try">✨ Try this out</span>}
        </div>
        {ageLabel && <span className="event-card__age">{ageLabel}</span>}
      </div>
      <div className="event-card__body">
        <span className="event-card__type">{TYPE_LABELS[event.event_type] || TYPE_LABELS.other}</span>
        <h4 className="event-card__title">{event.title}</h4>
        {when && <p className="event-card__when">{when}{isWeekly && <span className="event-card__repeat"> · every week</span>}</p>}
        {place && <p className="event-card__where">At {place}</p>}
        {event.price_from_aed ? <p className="event-card__price">From {event.price_from_aed} AED</p> : null}

        <button className="event-card__expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show less" : venue ? "View event & venue" : "View event"}
        </button>

        {expanded && <div className="event-card__details">
          {event.description && <p className="event-card__description">{event.description}</p>}
          {venue && <div className="event-card__venue">
            <div><span>Hosted at</span><strong>{venue.name}</strong><small>{[venue.neighborhood, venue.city].filter(Boolean).join(" · ")}</small></div>
            <Link className="btn small" href={`/v/${encodeURIComponent(venue.id)}`}>View venue</Link>
          </div>}
          <div className="event-card__actions">
            {ticket && <a className="btn small" href={ticket} target="_blank" rel="noopener noreferrer">Book</a>}
            {event.reservation_phone && <a className="btn small ghost" href={`tel:${String(event.reservation_phone).replace(/[^+\d]/g, "")}`}>Call</a>}
            {website && <a className="btn small ghost" href={website} target="_blank" rel="noopener noreferrer">Website</a>}
            {social && <a className="btn small ghost" href={social} target="_blank" rel="noopener noreferrer">Social</a>}
          </div>
        </div>}
      </div>
    </article>
  );
}
