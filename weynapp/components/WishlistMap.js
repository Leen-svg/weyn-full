"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapChooser from "./MapChooser";
import styles from "./WishlistMap.module.css";

const ABU_DHABI = [54.3773, 24.4539];

function coordinate(value) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

function mappedVenues(venues) {
  return venues.flatMap((venue) => {
    const latitude = coordinate(venue.latitude);
    const longitude = coordinate(venue.longitude);
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
    const map = new mapboxgl.Map({
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
          "circle-color": "#6f55e8",
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
      map.addLayer({
        id: "saved-place-points",
        type: "circle",
        source: "saved-places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#f3a7c0",
          "circle-radius": 10,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 3,
          "circle-emissive-strength": 1,
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
      for (const layer of ["saved-clusters", "saved-place-points"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
    });
    map.on("error", () => setMapError("The map couldn't load. Your saved list is still available."));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

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
        <div className={styles.selection}>
          <button type="button" className={styles.selectionClose} onClick={() => setSelectedId(null)} aria-label="Close selected place">×</button>
          <div>
            <strong>{selectedVenue.name}</strong>
            <span>{selectedVenue.neighborhood || "Abu Dhabi"}</span>
          </div>
          <MapChooser venue={selectedVenue} className="btn small primary" />
        </div>
      )}
    </section>
  );
}
