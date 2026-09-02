"use client";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";
import { trackProductEvent } from "@/lib/product-analytics";

const CATEGORY_LABELS = {
  "theme-park": "Theme park",
  waterpark: "Waterpark",
  "desert-safari": "Desert safari",
  landmark: "Landmark",
  cruise: "Cruise",
  tour: "Tour",
  show: "Show",
  museum: "Museum",
  adventure: "Adventure",
  other: "Attraction",
};

// Commercial inventory. Two non-negotiables, from the roadmap's
// "no revenue placement masquerading as an organic recommendation":
//   1. a visible partner label on every card
//   2. rel="sponsored" on the outbound link
export default function AttractionCard({ attraction }) {
  const cover = normalizeHttpUrl(attraction.cover_image_url);
  const href = normalizeHttpUrl(attraction.affiliate_url);
  const where = attraction.neighborhood || attraction.city;

  return (
    <article className="attraction-card">
      <div
        className="attraction-card__cover"
        style={cover ? { backgroundImage: `url("${cover}")` } : undefined}
        aria-hidden="true"
      />
      <div className="attraction-card__body">
        <span className="attraction-card__category">
          {CATEGORY_LABELS[attraction.category] || CATEGORY_LABELS.other}
        </span>
        <h4 className="attraction-card__title">{attraction.title}</h4>
        {where && <p className="attraction-card__where">{where}</p>}
        {attraction.price_from_aed ? (
          <p className="attraction-card__price">From {attraction.price_from_aed} AED</p>
        ) : null}
        {href && (
          <a
            className="btn small"
            href={href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={() => trackProductEvent("attraction_booking_clicked", { attraction_id: attraction.id, attraction_name: attraction.title })}
          >
            Book
          </a>
        )}
      </div>
    </article>
  );
}
