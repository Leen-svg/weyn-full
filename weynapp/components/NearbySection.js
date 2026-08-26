"use client";
import { useState } from "react";
import VenueCard from "./VenueCard";

export default function NearbySection() {
  const [state, setState] = useState("idle"); // idle | loading | denied | empty | done
  const [venues, setVenues] = useState([]);

  async function findNearby() {
    if (!navigator.geolocation) {
      setState("denied");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/nearby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: 15 }),
          });
          const data = await res.json();
          setVenues(data.venues || []);
          setState(data.venues?.length ? "done" : "empty");
        } catch {
          setState("empty");
        }
      },
      () => setState("denied"),
      { timeout: 8000 }
    );
  }

  return (
    <div className="card sky">
      <h2 style={{ fontSize: 22 }}>📍 What&apos;s near you</h2>

      {state === "idle" && (
        <>
          <p className="sub" style={{ marginBottom: 14 }}>Share your location and we&apos;ll show spots close by.</p>
          <button className="btn small ghost" onClick={findNearby}>Use my location</button>
        </>
      )}
      {state === "loading" && <p className="sub" style={{ marginBottom: 0 }}>Finding what&apos;s around…</p>}
      {state === "denied" && (
        <p className="sub" style={{ marginBottom: 0 }}>
          Couldn&apos;t get your location, you can still browse by vibe below.
        </p>
      )}
      {state === "empty" && (
        <p className="sub" style={{ marginBottom: 0 }}>
          No mapped spots near you yet, we&apos;re still adding coordinates as we go. Try the vibe picker instead.
        </p>
      )}
      {state === "done" && (
        <div className="venue-list-single" style={{ marginTop: 14 }}>
          {venues.map((v) => <VenueCard key={v.id} venue={v} />)}
        </div>
      )}
    </div>
  );
}

