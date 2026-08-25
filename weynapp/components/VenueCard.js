"use client";

import { useEffect, useRef, useState } from "react";
import { safeUrl } from "@/lib/sanitize";
import MapChooser from "./MapChooser";

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

export default function VenueCard({ venue, children, picked, priority = false }) {
  const spend = venue.avg_spend_aed === 0 ? "Free entry" : `~${venue.avg_spend_aed} AED pp`;
  const ageLabel = venue.age_restriction === "21-plus" ? "21+" : venue.age_restriction === "18-plus" ? "18+" : null;
  const videoUrl = safeUrl(venue.hero_video_url);
  const coverUrl = safeUrl(venue.cover_url);
  const media = (venue.media || [])
    .map((item) => ({ type: item.type, url: safeUrl(item.url) }))
    .filter((item) => item.url);
  if (!media.length && coverUrl) media.push({ type: "image", url: coverUrl });
  const [activeMedia, setActiveMedia] = useState(0);
  const mediaRef = useRef(null);
  const scrollFrame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  function goToMedia(index) {
    const next = Math.max(0, Math.min(media.length - 1, index));
    mediaRef.current?.scrollTo({ left: mediaRef.current.clientWidth * next, behavior: "smooth" });
    setActiveMedia(next);
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

  return (
    <div className={`venue-card${picked ? " picked" : ""}`}>
      <div className="venue-cover" style={media.length ? undefined : { background: gradientFor(venue.id) }}>
        {media.length ? (
          <>
            <div className="venue-media-track" ref={mediaRef} onScroll={trackMedia} aria-label={`${venue.name} photos and videos`}>
              {media.map((item, index) => (
                <div className="venue-media-slide" key={`${item.url}-${index}`}>
                  {item.type === "video" ? (
                    <video src={item.url} controls playsInline preload="none" aria-label={`${venue.name} video ${index + 1}`} />
                  ) : (
                    <img
                      src={item.url}
                      alt={`${venue.name} photo ${index + 1}`}
                      width="720"
                      height="405"
                      loading={priority && index === 0 ? "eager" : "lazy"}
                      fetchPriority={priority && index === 0 ? "high" : "auto"}
                      decoding="async"
                    />
                  )}
                </div>
              ))}
            </div>
            {media.length > 1 && (
              <>
                <button className="venue-media-arrow prev" type="button" aria-label="Previous photo" onClick={() => goToMedia(activeMedia - 1)} disabled={activeMedia === 0}>‹</button>
                <button className="venue-media-arrow next" type="button" aria-label="Next photo" onClick={() => goToMedia(activeMedia + 1)} disabled={activeMedia === media.length - 1}>›</button>
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
        {venue.city === "Dubai" && <span className="venue-city-badge">Dubai</span>}
      </div>
      <div className="venue-card-body">
        <div className="venue-name">{venue.name}</div>
        <div className="venue-meta">
          {[venue.neighborhood, spend, ageLabel].filter(Boolean).join(" · ")}
        </div>
        {venue.description && <p className="venue-desc">{venue.description}</p>}
        {Array.isArray(venue.tags) && venue.tags.length > 0 && (
          <div className="tag-row">
            {venue.tags.map((t) => <span key={t} className="tag-pill">{t}</span>)}
          </div>
        )}
        <div className="venue-links">
          {videoUrl && (
            <a className="btn small ghost" href={videoUrl} target="_blank" rel="noreferrer">
              ▶ Watch
            </a>
          )}
          <MapChooser venue={venue} compact />
        </div>
        {children}
      </div>
    </div>
  );
}


