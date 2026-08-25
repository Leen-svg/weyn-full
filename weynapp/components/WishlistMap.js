"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapChooser from "./MapChooser";
import { safeUrl } from "@/lib/sanitize";
import styles from "./WishlistMap.module.css";

const ABU_DHABI = [54.3773, 24.4539];

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

function venueGeoJson(venues) {
  return {
    type: "FeatureCollection",
    features: venues.map((venue) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [venue.longitude, venue.latitude] },
      properties: {
        id: venue.id,
        name: venue.name,
        neighborhood: venue.neighborhood || "",
      },
    })),
  };
}

export default function WishlistMap({ venues }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mapError, setMapError] = useState(null);
  const points = useMemo(() => mappedVenues(venues), [venues]);
  const selectedVenue = points.find((venue) => venue.id === selectedId) || null;

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setMapError("The map is waiting for its Mapbox token to reach this deployment.");
      return undefined;
    }
    if (!containerRef.current || !points.length) return undefined;

    mapboxgl.accessToken = token;
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/standard",
        center: ABU_DHABI,
        zoom: 9.8,
        attributionControl: false,
        dragRotate: false,
        touchPitch: false,
        config: {
          basemap: {
            theme: "monochrome",
            lightPreset: "day",
            showPointOfInterestLabels: false,
          },
        },
      });
    } catch {
      setMapError("The map couldn't start. Your saved list is still available.");
      return undefined;
    }
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      map.addSource("saved-places", {
        type: "geojson",
        data: venueGeoJson(points),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 48,
      });

      map.addLayer({
        id: "saved-clusters",
        type: "circle",
        source: "saved-places",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#7C3AED",
          "circle-radius": ["step", ["get", "point_count"], 21, 8, 27, 20, 33],
          "circle-stroke-color": "rgba(255,255,255,.92)",
          "circle-stroke-width": 3,
          "circle-emissive-strength": 1,
        },
      });
      map.addLayer({
        id: "saved-cluster-count",
        type: "symbol",
        source: "saved-places",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 13,
        },
        paint: { "text-color": "#ffffff" },
      });
      /* Unselected pins are white with a violet ring, so they read as
         markers rather than as blobs of brand colour on a monochrome
         basemap. The selected pin below inverts that. */
      map.addLayer({
        id: "saved-place-points",
        type: "circle",
        source: "saved-places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#ffffff",
          "circle-radius": 9,
          "circle-stroke-color": "#7C3AED",
          "circle-stroke-width": 3,
          "circle-emissive-strength": 1,
        },
      });

      /* The selected pin: filled violet, bigger, white ring. Drawn as
         its own layer on top rather than via feature-state because the
         source is clustered, so a point can leave and re-enter the
         unclustered set as the user zooms and its state would be lost.
         The filter is re-pointed by the selectedId effect below. */
      map.addLayer({
        id: "saved-place-selected",
        type: "circle",
        source: "saved-places",
        filter: ["==", ["get", "id"], "__none__"],
        paint: {
          "circle-color": "#7C3AED",
          "circle-radius": 15,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 4,
          "circle-emissive-strength": 1,
        },
      });

      /* Name pill under the selected pin, as in the mockup. */
      map.addLayer({
        id: "saved-place-selected-label",
        type: "symbol",
        source: "saved-places",
        filter: ["==", ["get", "id"], "__none__"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
          "text-offset": [0, 1.9],
          "text-anchor": "top",
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#191320",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2.2,
        },
      });

      if (points.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach((venue) => bounds.extend([venue.longitude, venue.latitude]));
        map.fitBounds(bounds, { padding: 54, maxZoom: 13, duration: 0 });
      } else {
        map.jumpTo({ center: [points[0].longitude, points[0].latitude], zoom: 13 });
      }

      map.on("click", "saved-clusters", (event) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;
        map.getSource("saved-places").getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (!error) map.easeTo({ center: feature.geometry.coordinates, zoom });
        });
      });
      map.on("click", "saved-place-points", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (id) setSelectedId(id);
      });
      // Tapping the already-selected pin closes the card again.
      map.on("click", "saved-place-selected", () => setSelectedId(null));
      for (const layer of ["saved-clusters", "saved-place-points", "saved-place-selected"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
    });
    let mapLoaded = false;
    map.once("load", () => { mapLoaded = true; });
    map.on("error", () => {
      if (!mapLoaded) setMapError("The map couldn't load. Your saved list is still available.");
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  /* Re-point the selected-pin layers whenever the selection changes.
     Guarded on the style being loaded: setFilter throws if the style
     is still in flight, which happens when a pin is clicked during
     the first paint. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const filter = ["==", ["get", "id"], selectedId || "__none__"];
    for (const layer of ["saved-place-selected", "saved-place-selected-label"]) {
      if (map.getLayer(layer)) map.setFilter(layer, filter);
    }
  }, [selectedId]);

  if (!points.length) {
    return (
      <div className={styles.empty} role="status">
        <span aria-hidden="true">📍</span>
        <strong>Your saved places need coordinates</strong>
        <p>They are safe in your list. We’ll place them on the map as their locations are verified.</p>
      </div>
    );
  }

  if (mapError) return <div className={`notice ${styles.error}`} role="status">{mapError}</div>;

  return (
    <section className={styles.frame} aria-label={`Map of ${points.length} saved places`}>
      <div ref={containerRef} className={styles.map} />
      <div className={styles.count}>{points.length} mapped</div>
      {selectedVenue && (
        <div className={styles.selection} key={selectedVenue.id}>
          <button type="button" className={styles.selectionClose} onClick={() => setSelectedId(null)} aria-label="Close selected place">×</button>

          {selectedVenue.cover_url && (
            <img
              className={styles.selectionThumb}
              src={safeUrl(selectedVenue.cover_url)}
              alt=""
              width="160"
              height="160"
              loading="lazy"
              decoding="async"
            />
          )}

          <div className={styles.selectionBody}>
            <div className={styles.selectionHead}>
              <strong>{selectedVenue.name}</strong>
              {typeof selectedVenue.rating === "number" && (
                <span className={styles.selectionRating}>
                  <span aria-hidden="true">★</span>
                  {selectedVenue.rating.toFixed(1)}
                </span>
              )}
            </div>
            <span className={styles.selectionPlace}>
              {selectedVenue.neighborhood || selectedVenue.city || "UAE"}
            </span>
            {selectedVenue.description && (
              <p className={styles.selectionDesc}>{selectedVenue.description}</p>
            )}
            <div className={styles.selectionChips}>
              {(selectedVenue.tags || []).slice(0, 2).map((tag) => (
                <span className="tag-pill" key={tag}>{tag}</span>
              ))}
              {typeof selectedVenue.avg_spend_aed === "number" && (
                <span className={styles.selectionSpend}>
                  {selectedVenue.avg_spend_aed === 0 ? "Free entry" : `~${selectedVenue.avg_spend_aed} AED pp`}
                </span>
              )}
            </div>
            <MapChooser venue={selectedVenue} className="btn small primary" />
          </div>
        </div>
      )}
    </section>
  );
}

