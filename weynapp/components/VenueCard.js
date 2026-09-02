"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Play } from "lucide-react";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";
import MapChooser from "./MapChooser";
import VenueMedia from "./VenueMedia";
import { hoursForToday } from "@/lib/opening-hours.mjs";
import { trackProductEvent } from "@/lib/product-analytics";

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, var(--purple-wash), var(--sky-wash))",
  "linear-gradient(135deg, var(--pink-wash), var(--yellow-wash))",
  "linear-gradient(135deg, var(--sky-wash), var(--yellow-wash))",
];

function gradientFor(id) {
  let hash = 0;
  for (const ch of id || "") hash = (hash + ch.charCodeAt(0)) % PLACEHOLDER_GRADIENTS.length;
  return PLACEHOLDER_GRADIENTS[hash];
}

export default function VenueCard({ venue, children, picked, priority = false, variant = "default" }) {
  const spend = venue.avg_spend_aed === 0 ? "Free entry" : `~${venue.avg_spend_aed} AED pp`;
  const ageLabel = venue.age_restriction === "21-plus" ? "21+" : venue.age_restriction === "18-plus" ? "18+" : null;
  const videoUrl = normalizeHttpUrl(venue.hero_video_url);
  const menuUrl = normalizeHttpUrl(venue.menu_url);
  const bookingUrl = normalizeHttpUrl(venue.booking_url);
  // A reservation link beats a phone call, and the booking number beats the
  // switchboard — so only the best available option is offered, not all three.
  const callNumber = venue.booking_phone || venue.phone || null;
  const todayHours = hoursForToday(venue.opening_hours);
  const websiteUrl = normalizeHttpUrl(venue.website);
  const instagramUrl = normalizeHttpUrl(venue.instagram_url);
  const tiktokUrl = normalizeHttpUrl(venue.tiktok_url);
  const coverUrl = normalizeHttpUrl(venue.cover_url);
  const initialMedia = (venue.media || [])
    .map((item) => ({ type: item.type, url: normalizeHttpUrl(item.url) }))
    .filter((item) => item.url);
  if (!initialMedia.length && coverUrl) initialMedia.push({ type: "image", url: coverUrl });
  if (videoUrl && !initialMedia.some((item) => item.url === videoUrl)) initialMedia.push({ type: "video", url: videoUrl });
  const [loadedMedia, setLoadedMedia] = useState(null);
  const [loadedTags, setLoadedTags] = useState(null);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const media = loadedMedia || initialMedia;
  const tags = loadedTags || (Array.isArray(venue.tags) ? venue.tags : []);
  const hasMoreMedia = !loadedMedia && Number(venue.media_count || 0) > initialMedia.length;
  const firstVideoIndex = media.findIndex((item) => item.type === "video");
  const discover = variant === "discover";
  const [activeMedia, setActiveMedia] = useState(0);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const mediaRef = useRef(null);
  const scrollFrame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  function goToMedia(index) {
    const next = Math.max(0, Math.min(media.length - 1, index));
    mediaRef.current?.scrollTo({ left: mediaRef.current.clientWidth * next, behavior: "smooth" });
    setActiveMedia(next);
  }

  function playVideo(index) {
    setPlayingVideo(index);
    goToMedia(index);
  }

  function trackMedia() {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      const node = mediaRef.current;
      if (!node?.clientWidth) return;
      setActiveMedia(Math.round(node.scrollLeft / node.clientWidth));
    });
  }

  async function loadAllMedia() {
    if (loadingMedia || detailsLoaded) return;
    setLoadingMedia(true);
    try {
      const response = await fetch(`/api/venues/${venue.id}/media`);
      const body = await response.json();
      if (response.ok && Array.isArray(body.media)) {
        const next = body.media.map((item) => ({ type: item.type, url: normalizeHttpUrl(item.url) })).filter((item) => item.url);
        if (next.length) setLoadedMedia(next);
        if (Array.isArray(body.tags)) setLoadedTags(body.tags);
      }
    } finally {
      setLoadingMedia(false); setDetailsLoaded(true);
    }
  }

  function toggleExpanded() {
    if (!expanded && !tags.length) loadAllMedia();
    setExpanded((current) => {
      if (!current) trackProductEvent("venue_opened", { venue_id: venue.id, venue_name: venue.name, surface: variant });
      return !current;
    });
  }

  function toggleFromCard(event) {
    if (event.target.closest("a, button, input, select, textarea, video")) return;
    toggleExpanded();
  }

  function toggleFromKeyboard(event) {
    if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    toggleExpanded();
  }

  return (
    <div
      className={`venue-card${picked ? " picked" : ""}${discover ? " discover-venue-card" : ""}${expanded ? " is-expanded" : ""}`}
      onClick={toggleFromCard}
      onKeyDown={toggleFromKeyboard}
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="venue-cover" style={media.length ? undefined : { background: gradientFor(venue.id) }}>
        {media.length ? (
          <>
            <div className="venue-media-track" ref={mediaRef} onScroll={trackMedia} aria-label={`${venue.name} photos and videos`}>
              {media.map((item, index) => (
                <div className="venue-media-slide" key={`${item.url}-${index}`}>
                  {item.type === "video" && playingVideo !== index ? (
                    <button className="venue-video-poster" type="button" onClick={() => playVideo(index)} aria-label={`Play ${venue.name} video ${index + 1}`}>
                      <span aria-hidden="true"><Play /></span>
                      <strong>Play video</strong>
                    </button>
                  ) : Math.abs(index - activeMedia) <= 1 ? (
                    <VenueMedia item={item} venueName={venue.name} index={index} priority={priority && index === 0} />
                  ) : <span className="venue-media-placeholder" aria-hidden="true" />}
                </div>
              ))}
            </div>
            {media.length > 1 && (
              <>
                <button className="venue-media-arrow prev" type="button" aria-label="Previous photo" onClick={() => goToMedia(activeMedia - 1)} disabled={activeMedia === 0}>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button className="venue-media-arrow next" type="button" aria-label="Next photo" onClick={() => goToMedia(activeMedia + 1)} disabled={activeMedia === media.length - 1}>
                  <ChevronRight aria-hidden="true" />
                </button>
                <div className="venue-media-dots" aria-label={`${activeMedia + 1} of ${media.length}`}>
                  {media.map((_, index) => (
                    <button
                      type="button"
                      key={index}
                      className={index === activeMedia ? "active" : ""}
                      aria-label={`Show media ${index + 1} of ${media.length}`}
                      aria-current={index === activeMedia ? "true" : undefined}
                      onClick={() => goToMedia(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : <span className="venue-cover-glyph">📍</span>}
        {discover && (
          <div className="discover-venue-card__overlay">
            <div className="venue-name">{venue.name}</div>
            <div className="venue-meta">
              {venue.neighborhood} · {spend}
              {ageLabel ? ` · ${ageLabel}` : ""}
            </div>
          </div>
        )}
      </div>
      <div className="venue-card-body">
        {!discover && (
          <>
            <div className="venue-name">{venue.name}</div>
            <div className="venue-meta">
              {venue.neighborhood} · {spend}
              {venue.is_aesthetic ? " · 📸 aesthetic" : ""}
              {ageLabel ? ` · 🔞 ${ageLabel}` : ""}
            </div>
          </>
        )}
        <button className="venue-expand-toggle" type="button" aria-expanded={expanded} onClick={toggleExpanded}>
          <span>{expanded ? "Show less" : "View details"}</span>
          {expanded ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
        </button>
        {expanded && (
          <div className="venue-card-expanded">
            {todayHours && <div className="venue-hours">Today: {todayHours}</div>}
            {venue.description && <p className="venue-desc">{venue.description}</p>}
            {tags.length > 0 && (
              <div className="tag-row">
                {tags.map((tag) => <span key={tag} className="tag-pill">{tag}</span>)}
              </div>
            )}
            {discover && children}
            <div className="venue-links">
              {firstVideoIndex >= 0 && (
                <button className="btn small ghost" type="button" onClick={() => playVideo(firstVideoIndex)}>
                  <Play aria-hidden="true" size={14} />
                  Play video
                </button>
              )}
              {hasMoreMedia && <button className="btn small ghost" type="button" disabled={loadingMedia} onClick={loadAllMedia}>{loadingMedia ? "Loading gallery…" : `View all ${venue.media_count} media`}</button>}
              {menuUrl && <a className="btn small ghost" href={menuUrl} target="_blank" rel="noopener noreferrer">☰ Menu</a>}
              {bookingUrl ? (
                <a className="btn small" href={bookingUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("venue_booking_clicked", { venue_id: venue.id, venue_name: venue.name })}>Book</a>
              ) : callNumber ? (
                <a className="btn small" href={`tel:${callNumber}`}>Call to book</a>
              ) : null}
              {instagramUrl && (
                <a className="btn small ghost" href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`${venue.name} on Instagram`}>Instagram</a>
              )}
              {tiktokUrl && (
                <a className="btn small ghost" href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label={`${venue.name} on TikTok`}>TikTok</a>
              )}
              {websiteUrl && (
                <a className="btn small ghost" href={websiteUrl} target="_blank" rel="noopener noreferrer">Website</a>
              )}
              <MapChooser venue={venue} compact />
            </div>
            {!discover && children}
          </div>
        )}
      </div>
    </div>
  );
}
