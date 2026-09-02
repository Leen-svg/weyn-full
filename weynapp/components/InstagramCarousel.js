"use client";
import { instagramEmbedUrl, extractInstagramPostUrl } from "@/lib/instagram-embed.mjs";

export default function InstagramCarousel({ value, title = "Instagram event carousel" }) {
  const src = instagramEmbedUrl(value);
  const permalink = extractInstagramPostUrl(value);
  if (!src || !permalink) return null;

  return <section className="event-instagram" aria-label="Instagram carousel">
    <iframe
      src={src}
      title={title}
      loading="lazy"
      allow="encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
    />
    <a href={permalink} target="_blank" rel="noopener noreferrer">View on Instagram</a>
  </section>;
}
