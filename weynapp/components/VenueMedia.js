"use client";

import Image from "next/image";

import { useState } from "react";
import { highResPhoto, normalizeHttpUrl, videoPresentation } from "@/lib/media-url.mjs";

export default function VenueMedia({ item, venueName, index = 0, priority = false, preview = false }) {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const url = normalizeHttpUrl(item.url);
  if (!url) return null;
  if (item.type === "image") {
    return (
      <Image
        src={highResPhoto(url, 1600)}
        alt={preview ? "" : `${venueName} photo ${index + 1}`}
        fill
        sizes="(max-width: 680px) calc(100vw - 32px), (max-width: 1100px) 50vw, 560px"
        priority={priority}
        quality={82}
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
    );
  }
  const presentation = videoPresentation(url);
  if (!presentation) return null;
  if (!videoLoaded) {
    return (
      <div className="venue-video-embed venue-video-embed--deferred">
        <button className="btn small" type="button" onClick={() => setVideoLoaded(true)}>
          ▶ Play video
        </button>
        <a href={presentation.url} target="_blank" rel="noopener noreferrer">Open {presentation.provider} ↗</a>
      </div>
    );
  }
  if (presentation.kind === "direct") {
    return <video src={presentation.src} controls playsInline preload="none" autoPlay aria-label={`${venueName} video ${index + 1}`} />;
  }
  return (
    <div className="venue-video-embed">
      <iframe
        src={presentation.src}
        title={`${venueName} ${presentation.provider} video ${index + 1}`}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <a href={presentation.url} target="_blank" rel="noopener noreferrer">Open {presentation.provider} ↗</a>
    </div>
  );
}
