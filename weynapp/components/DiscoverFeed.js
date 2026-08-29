"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Bookmark, CalendarCheck, ChevronLeft, ChevronRight, MapPin, Phone, Play, Send } from "lucide-react";
import ShareToGroupButton from "./ShareToGroupButton";
import { highResPhoto, normalizeHttpUrl } from "@/lib/media-url.mjs";

const CITIES = ["All", "Abu Dhabi", "Dubai"];
const FOR_YOU = "For you";

// The card has no photograph often enough that a grey placeholder would be
// the dominant impression of the whole surface. Instead each venue gets a
// stable two-tone wash derived from its id, so a photo-less place still
// reads as a designed poster rather than as a failed image load.
const WASHES = [
  ["#3b2a5e", "#7c5cc4"],
  ["#123a3a", "#2f8f7a"],
  ["#4a1f36", "#c0567f"],
  ["#1c2f4d", "#4d7fc4"],
  ["#4a3312", "#c08a3e"],
  ["#2b1f3d", "#6b4fa0"],
];

function washFor(id) {
  let hash = 0;
  for (const ch of id || "") hash = (hash * 31 + ch.charCodeAt(0)) % WASHES.length;
  return WASHES[hash];
}

function placeLabel(venue) {
  const city = (venue.city || "").trim();
  const hood = (venue.neighborhood || "").trim();
  if (!hood || hood.toLowerCase() === city.toLowerCase()) return city || hood;
  return `${city} · ${hood}`;
}

function spendLabel(venue) {
  if (venue.avg_spend_aed === 0) return "Free entry";
  if (!venue.avg_spend_aed) return null;
  return `~${venue.avg_spend_aed} AED pp`;
}

export default function DiscoverFeed({ venues = [], savedIds = [], isLoggedIn = false }) {
  const [city, setCity] = useState("All");
  const [vibe, setVibe] = useState(FOR_YOU);
  const [saved, setSaved] = useState(() => new Set(savedIds));
  const [needsLogin, setNeedsLogin] = useState(false);
  const busy = useRef(new Set());

  // Chips come from the tags actually present on this feed, so the row never
  // offers a filter that would return nothing.
  const vibes = useMemo(() => {
    const counts = new Map();
    for (const v of venues) {
      for (const tag of v.tags || []) {
        const name = typeof tag === "string" ? tag : tag?.display_name;
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    return [FOR_YOU, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n]) => n)];
  }, [venues]);

  const shown = useMemo(
    () =>
      venues.filter((v) => {
        if (city !== "All" && v.city !== city) return false;
        if (vibe === FOR_YOU) return true;
        return (v.tags || []).some((t) => (typeof t === "string" ? t : t?.display_name) === vibe);
      }),
    [venues, city, vibe]
  );

  async function toggleSave(id) {
    if (busy.current.has(id)) return;
    busy.current.add(id);
    const wasSaved = saved.has(id);
    setNeedsLogin(false);
    // Optimistic: the press is the feedback. Reverted if the call fails.
    setSaved((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      const res = await fetch("/api/saves", {
        method: wasSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: id }),
      });
      if (!res.ok) {
        if (res.status === 401) setNeedsLogin(true);
        setSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    } finally {
      busy.current.delete(id);
    }
  }

  return (
    <div className="discover-screen">
      <h1 className="sr-only">Discover places in Abu Dhabi and Dubai</h1>
      <div className="discover-screen__filters">
        <div className="discover-cities" role="group" aria-label="City">
          {CITIES.map((c) => (
            <button
              key={c}
              type="button"
              className={c === city ? "is-on" : undefined}
              aria-pressed={c === city}
              onClick={() => setCity(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="discover-vibes" role="group" aria-label="Vibe">
          {vibes.map((v) => (
            <button
              key={v}
              type="button"
              className={v === vibe ? "is-on" : undefined}
              aria-pressed={v === vibe}
              onClick={() => setVibe(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {needsLogin && (
        <p className="discover-screen__login" role="status">
          <Link href="/login">Log in</Link> to save places.
        </p>
      )}

      {shown.length === 0 ? (
        <div className="discover-screen__empty">
          <h2>Nothing here yet</h2>
          <p>No {vibe === FOR_YOU ? "places" : `“${vibe}” places`} in {city === "All" ? "either city" : city} right now.</p>
          <button type="button" className="btn" onClick={() => { setCity("All"); setVibe(FOR_YOU); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <ol className="discover-feed">
          {shown.map((venue, index) => (
            <DiscoverSlide
              key={venue.id}
              venue={venue}
              priority={index < 2}
              saved={saved.has(venue.id)}
              onSave={() => toggleSave(venue.id)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function DiscoverSlide({ venue, priority, saved, onSave }) {
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(() => new Set());
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);
  const frame = useRef(0);

  const maps = normalizeHttpUrl(venue.google_maps_url);
  const video = normalizeHttpUrl(venue.hero_video_url);
  const menu = normalizeHttpUrl(venue.menu_url);
  const booking = normalizeHttpUrl(venue.booking_url);
  const callNumber = venue.booking_phone || venue.phone || null;
  const [from, to] = washFor(venue.id);
  const spend = spendLabel(venue);
  const age = venue.age_restriction === "21-plus" ? "21+" : venue.age_restriction === "18-plus" ? "18+" : null;
  const tags = (venue.tags || [])
    .map((t) => (typeof t === "string" ? t : t?.display_name))
    .filter(Boolean)
    .slice(0, 3);

  // A venue usually has several photos. Showing only the cover meant there was
  // no way to see the rest without leaving the feed.
  const shots = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const item of venue.media || []) {
      const url = normalizeHttpUrl(item?.url);
      if (!url || item?.type === "video" || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    const cover = normalizeHttpUrl(venue.cover_url);
    if (cover && !seen.has(cover)) out.unshift(cover);
    return out.filter((u) => !broken.has(u));
  }, [venue.media, venue.cover_url, broken]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const goTo = useCallback((index) => {
    const node = trackRef.current;
    if (!node) return;
    const next = Math.max(0, Math.min(shots.length - 1, index));
    node.scrollTo({ left: node.clientWidth * next, behavior: "smooth" });
    setActive(next);
  }, [shots.length]);

  function track() {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const node = trackRef.current;
      if (!node?.clientWidth) return;
      setActive(Math.round(node.scrollLeft / node.clientWidth));
    });
  }

  return (
    <li className="discover-slide">
      <div className="discover-slide__media" style={{ "--wash-from": from, "--wash-to": to }}>
        <span className="discover-slide__watermark" aria-hidden="true">{venue.name}</span>

        {shots.length > 0 && (
          <div
            className="discover-slide__track"
            ref={trackRef}
            onScroll={track}
            aria-label={`${venue.name} photos`}
          >
            {shots.map((url, index) => (
              <div className="discover-slide__shot" key={url}>
                <Image
                  src={highResPhoto(url, 2048)}
                  alt=""
                  fill
                  sizes="(max-width: 719px) 100vw, (max-width: 1099px) 100vw, 60vw"
                  priority={priority && index === 0}
                  quality={82}
                  onError={() => setBroken((prev) => new Set(prev).add(url))}
                />
              </div>
            ))}
          </div>
        )}

        {shots.length > 1 && (
          <>
            <button
              className="discover-slide__arrow discover-slide__arrow--prev"
              type="button"
              aria-label="Previous photo"
              disabled={active === 0}
              onClick={() => goTo(active - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              className="discover-slide__arrow discover-slide__arrow--next"
              type="button"
              aria-label="Next photo"
              disabled={active === shots.length - 1}
              onClick={() => goTo(active + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
            <div className="discover-slide__dots" aria-label={`Photo ${active + 1} of ${shots.length}`}>
              {shots.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  className={index === active ? "is-on" : undefined}
                  aria-label={`Show photo ${index + 1} of ${shots.length}`}
                  aria-current={index === active ? "true" : undefined}
                  onClick={() => goTo(index)}
                />
              ))}
            </div>
          </>
        )}

        {video && !playing && (
          <button className="discover-slide__play" type="button" onClick={() => setPlaying(true)} aria-label={`Play ${venue.name} video`}>
            <Play aria-hidden="true" />
          </button>
        )}
        {video && playing && (
          <video className="discover-slide__video" src={video} autoPlay muted loop playsInline controls />
        )}
      </div>

      <div className="discover-slide__panel">
        <div className="discover-slide__copy">
          <p className="discover-slide__city">{placeLabel(venue)}</p>
          <h2 className="discover-slide__name">{venue.name}</h2>
          {venue.description && <p className="discover-slide__desc">{venue.description}</p>}

          {(spend || age || tags.length > 0) && (
            <ul className="discover-slide__signals">
              {spend && <li>{spend}</li>}
              {age && <li>{age}</li>}
              {tags.map((t) => <li key={t}>{t}</li>)}
            </ul>
          )}
        </div>

        <div className="discover-slide__actions">
          <button
            type="button"
            className={saved ? "discover-save is-on" : "discover-save"}
            onClick={onSave}
            aria-pressed={saved}
          >
            <Bookmark aria-hidden="true" />
            {saved ? "Saved" : "Save"}
          </button>
          {maps && (
            <a className="discover-slide__action" href={maps} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden="true" />
              <span className="sr-only">Open </span>Maps
            </a>
          )}
          {menu && (
            <a className="discover-slide__action" href={menu} target="_blank" rel="noopener noreferrer">
              <BookOpen aria-hidden="true" />
              <span className="sr-only">Open </span>Menu
            </a>
          )}
          {booking ? (
            <a className="discover-slide__action" href={booking} target="_blank" rel="noopener noreferrer">
              <CalendarCheck aria-hidden="true" />
              Book
            </a>
          ) : callNumber ? (
            <a className="discover-slide__action" href={`tel:${callNumber}`}>
              <Phone aria-hidden="true" />
              Call
            </a>
          ) : null}
          <ShareToGroupButton
            className="discover-slide__action"
            label={<><Send aria-hidden="true" />Send</>}
            text={`${venue.name}${venue.neighborhood ? ` — ${venue.neighborhood}` : ""}${maps ? `\n${maps}` : ""}`}
          />
        </div>
      </div>
    </li>
  );
}
