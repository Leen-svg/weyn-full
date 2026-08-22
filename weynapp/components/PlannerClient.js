"use client";
import { useEffect, useMemo, useState } from "react";
import MapChooser from "./MapChooser";
import { buildTimeline, coordinates, orderStops } from "@/lib/planner-utils.mjs";

async function optimizedStops(items) {
  if (items.length < 3 || items.some((place) => !coordinates(place))) return orderStops(items);
  try {
    const response = await fetch("/api/planner/optimize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ places: items.map(({ id, kind, latitude, longitude }) => ({ id, kind, latitude, longitude })) }) });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.order)) throw new Error("fallback");
    const byKey = new Map(items.map((place) => [`${place.kind}:${place.id}`, place]));
    return data.order.map((key) => byKey.get(key)).filter(Boolean);
  } catch { return orderStops(items); }
}

export default function PlannerClient() {
  const [data, setData] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [input, setInput] = useState(""), [busy, setBusy] = useState(false), [picked, setPicked] = useState([]), [ordered, setOrdered] = useState([]);
  const [startTime, setStartTime] = useState("10:00"), [title, setTitle] = useState("");
  const load = async () => { try { const response = await fetch("/api/planner"); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Couldn't load your plans"); setData(body); } catch (loadError) { setError(loadError.message); } };
  useEffect(() => { load(); }, []);
  const places = data?.places || [];
  const neighborhoods = useMemo(() => Object.entries(places.reduce((all, place) => { const name = place.neighborhood || place.city || "Saved elsewhere"; all[name] = (all[name] || 0) + 1; return all; }, {})).sort((a, b) => b[1] - a[1]), [places]);
  const itinerary = useMemo(() => buildTimeline(ordered, startTime), [ordered, startTime]);

  async function importPlace() {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/import-place", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error || "Couldn't import that place");
    setInput(""); setNotice(body.matched ? `Saved ${body.place.name}.` : `Added ${body.place.name} to your private list.`); load();
  }

  async function togglePlace(key) {
    const next = picked.includes(key) ? picked.filter((item) => item !== key) : picked.length < 4 ? [...picked, key] : picked;
    setPicked(next); setOrdered(await optimizedStops(places.filter((place) => next.includes(`${place.kind}:${place.id}`))));
  }

  async function createBoard() {
    if (!title.trim() || !picked.length) return;
    setBusy(true); setError("");
    const response = await fetch("/api/boards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, isPublic: true }) });
    const body = await response.json();
    if (!response.ok) { setBusy(false); return setError(body.error); }
    for (const [position, place] of ordered.entries()) {
      const add = await fetch(`/api/boards/${body.board.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", kind: place.kind, placeId: place.id, position }) });
      if (!add.ok) { setBusy(false); return setError("The board was created, but one place could not be added."); }
    }
    setTitle(""); setBusy(false); setNotice("Board created. Open it to invite friends, vote, or reorder places."); load();
  }

  async function follow(curator) {
    const response = await fetch("/api/planner", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: curator.following ? "unfollow" : "follow", curatorId: curator.id }) });
    if (response.ok) setData({ ...data, curators: data.curators.map((item) => item.id === curator.id ? { ...item, following: !item.following } : item) });
  }

  if (!data) return <p className="sub">{error || "Loading your plans…"}</p>;

  return (
    <div className="planner-stack">
      <section className="card">
        <span className="eyebrow">Magic import</span>
        <h2>Paste to map</h2>
        <p className="sub">Paste a TikTok or Instagram link with its caption, or a WhatsApp message. Weyn extracts one UAE place and saves it privately.</p>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="Paste the link plus caption, place name, or message…" />
        <button className="btn primary block" disabled={busy || !input.trim()} onClick={importPlace}>{busy ? "Finding it…" : "Save to Want to Try"}</button>
      </section>

      <section className="card">
        <div className="toggle-row">
          <div>
            <strong>Ghost Mode</strong>
            <div className="sub">Hide your public posts and friend activity while you browse and save.</div>
          </div>
          <input
            aria-label="Ghost Mode"
            type="checkbox"
            checked={data.ghostMode}
            onChange={async (event) => {
              const value = event.target.checked;
              setData({ ...data, ghostMode: value });
              await fetch("/api/planner", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ghost", ghostMode: value }) });
            }}
          />
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Your saved map</span>
        <h2>Plan by neighborhood</h2>
        <p className="sub">These counts use your real saved places; no missing amenity or seasonal data is assumed.</p>
        <div className="tag-row">{neighborhoods.map(([name, count]) => <span className="tag-pill" key={name}>{name} · {count}</span>)}</div>
      </section>

      <section className="card">
        <h2>Build a Perfect Day</h2>
        <p className="sub">Choose up to four places. Weyn optimizes the stop order, estimates travel time, and lets each person open their preferred map app.</p>
        <label className="field"><span>Start time</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
        <div className="venue-list-single">
          {places.map((place) => {
            const key = `${place.kind}:${place.id}`;
            const selected = picked.includes(key);
            return (
              <div className={`card ${selected ? "picked" : ""}`} key={key}>
                <label className="toggle-row">
                  <input type="checkbox" checked={selected} onChange={() => togglePlace(key)} />
                  <span><strong>{place.name}</strong><br /><small>{place.neighborhood || place.city || "Private place"}</small></span>
                </label>
              </div>
            );
          })}
        </div>
        {itinerary.length > 0 && (
          <div className="card">
            <h3>Your route</h3>
            {itinerary.map((place, index) => (
              <div key={`${place.kind}:${place.id}`} className="details-row">
                <div>
                  <strong>{place.arrival} · {index + 1}. {place.name}</strong>
                  {place.travelToNext && <div className="sub">About {place.travelToNext} min drive to the next stop</div>}
                </div>
                <MapChooser venue={place} compact />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <span className="eyebrow">Burner list + trip board</span>
        <h2>Share this plan</h2>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Oman Roadtrip 2026" />
        <button className="btn primary block" disabled={busy || !picked.length || !title.trim()} onClick={createBoard}>Create collaborative board</button>
        {data.boards.map((board) => (
          <div className="details-row" key={board.id}>
            <strong>{board.title}</strong>
            <div>
              <a className="btn small ghost" href={`/plan/boards/${board.id}`}>Edit</a>{" "}
              <button className="btn small ghost" onClick={() => navigator.share ? navigator.share({ title: board.title, url: `${location.origin}/b/${board.share_slug}` }) : navigator.clipboard.writeText(`${location.origin}/b/${board.share_slug}`)}>Share</button>
            </div>
          </div>
        ))}
      </section>

      {data.curators.length > 0 && (
        <section className="card">
          <span className="eyebrow">Curators, not contacts</span>
          <h2>Local tastemakers</h2>
          <div className="venue-grid">
            {data.curators.map((curator) => (
              <div className="card" key={curator.id}>
                <a href={`/u/${curator.id}`}><strong>@{curator.display_name}</strong><p className="sub">{curator.bio || "Local Weyn curator"}</p></a>
                <button className={`btn small ${curator.following ? "" : "ghost"}`} onClick={() => follow(curator)}>{curator.following ? "Following" : "Follow"}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {notice && <div className="notice">{notice}</div>}
      {error && <div className="notice err">{error}</div>}
    </div>
  );
}
