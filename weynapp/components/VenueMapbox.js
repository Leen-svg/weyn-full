"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Rendered only when NEXT_PUBLIC_MAPBOX_TOKEN is set. WishlistMap falls back to
// the OpenStreetMap embed otherwise, so the map never disappears.
export default function VenueMapbox({ points, selected, onSelect, token, className }) {
  const holder = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map());

  // Build the map once. Re-running this on every selection change would tear
  // down and recreate the GL context, which flashes and loses the camera.
  useEffect(() => {
    if (!holder.current || map.current) return undefined;
    mapboxgl.accessToken = token;
    const first = selected || points[0];
    map.current = new mapboxgl.Map({
      container: holder.current,
      style: "mapbox://styles/mapbox/standard",
      center: [first.longitude, first.latitude],
      zoom: 13,
      attributionControl: false,
    });
    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.current.scrollZoom.disable();
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, [token]);

  // Keep one marker per point.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const live = new Set();
    for (const point of points) {
      live.add(point.id);
      if (markers.current.has(point.id)) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "weyn-map-pin";
      el.setAttribute("aria-label", point.name);
      el.addEventListener("click", () => onSelect?.(point.id));
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([point.longitude, point.latitude])
        .addTo(instance);
      markers.current.set(point.id, marker);
    }
    for (const [id, marker] of markers.current) {
      if (live.has(id)) continue;
      marker.remove();
      markers.current.delete(id);
    }
  }, [points, onSelect]);

  // Reflect the selection: highlight its pin and ease the camera onto it.
  useEffect(() => {
    if (!map.current || !selected) return;
    for (const [id, marker] of markers.current) {
      marker.getElement().classList.toggle("is-on", id === selected.id);
    }
    map.current.easeTo({ center: [selected.longitude, selected.latitude], zoom: 14, duration: 600 });
  }, [selected]);

  return <div ref={holder} className={className} />;
}
