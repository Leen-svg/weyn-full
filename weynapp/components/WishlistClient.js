"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import VenueCard from "./VenueCard";
import VenueActions from "./VenueActions";

const WishlistMap = dynamic(() => import("./WishlistMap"), {
  ssr: false,
  loading: () => <div className="home-skeleton__card" aria-label="Loading saved places map" />,
});

function validCoordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

export default function WishlistClient({ initialVenues }) {
  const [venues, setVenues] = useState(initialVenues);
  const [view, setView] = useState("list");
  const mappedCount = useMemo(
    () => venues.filter((venue) => validCoordinate(venue.latitude, -90, 90) && validCoordinate(venue.longitude, -180, 180)).length,
    [venues],
  );

  if (!venues.length) {
    return <p className="sub">Nothing saved yet, spots you save from the picker will show up here.</p>;
  }

  return (
    <>
      <div className="chips" role="group" aria-label="Saved places view" style={{ marginBottom: 18 }}>
        <button type="button" className={`chip ${view === "list" ? "sel" : ""}`} aria-pressed={view === "list"} onClick={() => setView("list")}>List · {venues.length}</button>
        <button type="button" className={`chip ${view === "map" ? "sel" : ""}`} aria-pressed={view === "map"} onClick={() => setView("map")}>Map · {mappedCount}</button>
      </div>

      {view === "map" ? (
        <WishlistMap venues={venues} />
      ) : (
        <div className="venue-list-single">
          {venues.map((v) => (
            <VenueCard key={v.id} venue={v}>
              <VenueActions venue={v} initialSaved onRemoved={(id) => setVenues((prev) => prev.filter((x) => x.id !== id))} />
            </VenueCard>
          ))}
        </div>
      )}
    </>
  );
}
