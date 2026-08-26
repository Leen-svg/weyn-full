"use client";

import { useMemo, useState } from "react";
import MapChooser from "./MapChooser";
import styles from "./WishlistMap.module.css";

function coordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function mappedVenues(venues) {
  return venues.flatMap((venue) => {
    const latitude = coordinate(venue.latitude, -90, 90);
    const longitude = coordinate(venue.longitude, -180, 180);
    if (latitude === null || longitude === null) return [];
    return [{ ...venue, latitude, longitude }];
  });
}

function openStreetMapEmbed(venue) {
  const latitudeDelta = 0.035;
  const longitudeDelta = 0.05;
  const params = new URLSearchParams({
    bbox: [
      venue.longitude - longitudeDelta,
      venue.latitude - latitudeDelta,
      venue.longitude + longitudeDelta,
      venue.latitude + latitudeDelta,
    ].join(","),
    layer: "mapnik",
    marker: `${venue.latitude},${venue.longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

export default function WishlistMap({ venues }) {
  const [selectedId, setSelectedId] = useState(null);
  const points = useMemo(() => mappedVenues(venues), [venues]);
  const selectedVenue = points.find((venue) => venue.id === selectedId) || points[0] || null;

  if (!points.length) {
    return (
      <div className={styles.empty} role="status">
        <span aria-hidden="true">📍</span>
        <strong>Your saved places need coordinates</strong>
        <p>They are safe in your list. We’ll place them on the map as their locations are verified.</p>
      </div>
    );
  }

  return (
    <section className={styles.frame} aria-label={`Map of ${points.length} saved places`}>
      <iframe
        key={selectedVenue.id}
        className={styles.map}
        src={openStreetMapEmbed(selectedVenue)}
        title={`Map showing ${selectedVenue.name}`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className={styles.count}>{points.length} mapped</div>
      {points.length > 1 && (
        <div className={styles.picker} role="list" aria-label="Choose a saved place on the map">
          {points.map((venue) => (
            <button
              type="button"
              role="listitem"
              className={venue.id === selectedVenue.id ? styles.pickerActive : ""}
              aria-pressed={venue.id === selectedVenue.id}
              onClick={() => setSelectedId(venue.id)}
              key={venue.id}
            >
              {venue.name}
            </button>
          ))}
        </div>
      )}
      <div className={styles.selection}>
        <div>
          <strong>{selectedVenue.name}</strong>
          <span>{selectedVenue.neighborhood || selectedVenue.city || "UAE"}</span>
        </div>
        <MapChooser venue={selectedVenue} className="btn small primary" />
      </div>
    </section>
  );
}
