"use client";
import { useEffect, useMemo, useState } from "react";
import MapChooser from "./MapChooser";
import { FEATURES } from "@/lib/features";
import { buildTimeline, coordinates, orderStops } from "@/lib/planner-utils.mjs";

// Use a native select so keyboard, screen-reader, and mobile picker behaviour
// remains predictable while the visible field still follows Weyn's styling.
const START_TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30; // 06:00 through 23:30
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const value = `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const label = `${hours12}:${String(minutes).padStart(2, "0")} ${hours24 < 12 ? "AM" : "PM"}`;
  return { value, label };
});

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
  const [startTime, setStartTime] = useState("10:00"), [title, setTitle] = useState(""), [visibility, setVisibility] = useState("");
  const load = async () => { try { const response = await fetch("/api/planner", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Couldn't load your plans"); setData(body); } catch (loadError) { setError(loadError.message); } };
  useEffect(() => { load(); }, []);
  const places = data?.places || [];
  const itinerary = useMemo(() => buildTimeline(ordered, startTime), [ordered, startTime]);

  async function importPlace() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/import-place", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }) });
      const body = await response.json();
      if (!response.ok) return setError(body.error || "Couldn't import that place");
      setInput("");
      setNotice(body.matched ? `Saved ${body.place.name}.` : `Added ${body.place.name} to your private list.`);
      await load();
    } catch {
      setError("Weyn couldn't reach the place importer. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function togglePlace(key) {
    const next = picked.includes(key) ? picked.filter((item) => item !== key) : picked.length < 4 ? [...picked, key] : picked;
    setPicked(next);
    setOrdered(orderStops(places.filter((place) => next.includes(`${place.kind}:${place.id}`))));
  }

  async function optimizePicked() {
    setBusy(true);
    setError("");
    try {
      setOrdered(await optimizedStops(places.filter((place) => picked.includes(`${place.kind}:${place.id}`))));
    } finally {
      setBusy(false);
    }
  }

  async function createBoard() {
    if (!title.trim() || !picked.length || !visibility) return;
    setBusy(true); setError("");
    const response = await fetch("/api/boards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, visibility }) });
    const body = await response.json();
    if (!response.ok) { setBusy(false); return setError(body.error); }
    for (const [position, place] of ordered.entries()) {
      const add = await fetch(`/api/boards/${body.board.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", kind: place.kind, placeId: place.id, position }) });
      if (!add.ok) { setBusy(false); return setError("The board was created, but one place could not be added."); }
    }
    setTitle(""); setVisibility(""); setBusy(false); setNotice("Board created. Open it to invite friends, vote, or reorder places."); load();
  }

  async function follow(curator) {
    const response = await fetch("/api/planner", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: curator.following ? "unfollow" : "follow", curatorId: curator.id }) });
    if (response.ok) setData({ ...data, curators: data.curators.map((item) => item.id === curator.id ? { ...item, following: !item.following } : item) });
  }

  if (!data) return <p className="sub">{error || "Loading your plans…"}</p>;

  return (
    <div className="planner-stack">
      {notice && <div className="notice" role="status">{notice}</div>}
      {error && <div className="notice err" role="alert">{error}</div>}

      <div className="planner-top-grid">
        <section className="card planner-import">
          <span className="eyebrow">Magic import</span>
          <h2>Paste to map</h2>
          <p className="sub">Paste a TikTok, Instagram link, or WhatsApp message. Weyn finds the UAE place and saves it privately.</p>
          <label className="field planner-import-field">
            <span>Link, caption, or message</span>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000} placeholder="Paste a link, caption, place name, or message…" />
          </label>
          <button className="btn primary btn-full" disabled={busy || !input.trim()} onClick={importPlace}>{busy ? "Finding it…" : "Save place"}</button>
        </section>

      </div>

      <section className="card planner-builder">
        <div className="planner-section-heading">
          <div>
            <span className="eyebrow">Perfect day</span>
            <h2>Choose the stops</h2>
          </div>
          <p className="sub">Pick up to four places. Weyn orders them and estimates when you will arrive.</p>
        </div>

        <div className="planner-controls">
          <label className="field">
            <span>Start time</span>
            <select value={startTime} onChange={(event) => setStartTime(event.target.value)}>
              {START_TIME_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button
            className="btn primary"
            type="button"
            disabled={picked.length < 2 || busy}
            onClick={optimizePicked}
          >
            {busy ? "Optimizing…" : "Optimize selected route"}
          </button>
        </div>

        {places.length ? (
          <div className="planner-place-grid">
            {places.map((place) => {
              const key = `${place.kind}:${place.id}`;
              const selected = picked.includes(key);
              return (
                <label className={`planner-place-option ${selected ? "picked" : ""}`} key={key}>
                  <input type="checkbox" checked={selected} onChange={() => togglePlace(key)} />
                  <span><strong>{place.name}</strong><small>{place.neighborhood || place.city || "Private place"}</small></span>
                </label>
              );
            })}
          </div>
        ) : <div className="planner-empty"><strong>No saved places yet.</strong><span>Save a spot from Discover or Find, then return here.</span></div>}

        {itinerary.length > 0 && (
          <div className="planner-route">
            <h3>Your route</h3>
            {itinerary.map((place, index) => (
              <div key={`${place.kind}:${place.id}`} className="planner-route-stop">
                <span className="planner-route-number">{index + 1}</span>
                <div>
                  <strong>{place.arrival} · {place.name}</strong>
                  {index < itinerary.length - 1 && (
                    <div className="sub">
                      {place.travelToNext ? `About ${place.travelToNext} minutes to the next stop` : "Travel time unavailable until both places are mapped"}
                    </div>
                  )}
                </div>
                <MapChooser venue={place} compact />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card planner-share">
        <div>
          <span className="eyebrow">Collaborate</span>
          <h2>Share this plan</h2>
          <p className="sub">Create a board so friends can vote, reorder stops, and add ideas.</p>
        </div>
        <div className="planner-share-form">
          <label className="field"><span>Board name</span><input type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Friday in Dubai" /></label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>Who can see this board?</legend>
            <div className="chips" role="radiogroup" aria-label="Board visibility">
              {[
                ["private", "Private", "Only you"],
                ["friends", "Friends", "Your accepted friends"],
                ["public", "Public", "Anyone on Weyn"],
              ].map(([value, label, detail]) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === value}
                  className={`chip ${visibility === value ? "sel" : ""}`}
                  onClick={() => setVisibility(value)}
                  key={value}
                  title={detail}
                >
                  {label}
                </button>
              ))}
            </div>
            {!visibility && <small>Choose Private, Friends, or Public before creating the board.</small>}
          </fieldset>
          <button className="btn primary" disabled={busy || !picked.length || !title.trim() || !visibility} onClick={createBoard}>Create board</button>
        </div>
        {!!data.boards.length && <div className="planner-board-list">{data.boards.map((board) => (
          <div className="planner-board-row" key={board.id}>
            <strong>{board.title} <small className={`saved-visibility ${board.archived_at ? "private" : board.visibility || (board.is_public ? "public" : "private")}`}>{board.archived_at ? "archived" : board.visibility || (board.is_public ? "public" : "private")}</small></strong>
            <div><a className="btn small ghost" href={`/plan/boards/${board.id}`}>Open</a>{!board.archived_at && board.visibility !== "private" && <button className="btn small ghost" onClick={() => navigator.share ? navigator.share({ title: board.title, url: `${location.origin}/b/${board.share_slug}` }) : navigator.clipboard.writeText(`${location.origin}/b/${board.share_slug}`)}>Share</button>}</div>
          </div>
        ))}</div>}
      </section>

      {FEATURES.creators && data.curators.length > 0 && (
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

    </div>
  );
}
