"use client";
import { useState } from "react";
import VenueCard from "./VenueCard";
import VenueActions from "./VenueActions";

export default function WishlistClient({ initialVenues }) {
  const [venues, setVenues] = useState(initialVenues);

  if (!venues.length) {
    return <p className="sub">Nothing saved yet, spots you save from the picker will show up here.</p>;
  }

  return (
    <>
      {venues.map((v) => (
        <VenueCard key={v.id} venue={v}>
          <VenueActions venue={v} initialSaved onRemoved={(id) => setVenues((prev) => prev.filter((x) => x.id !== id))} />
        </VenueCard>
      ))}
    </>
  );
}
