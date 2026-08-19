"use client";
import { useState, useEffect, useCallback } from "react";
import { safeUrl } from "@/lib/sanitize";

export default function VenueEditor() {
  const [q, setQ] = useState("");
  const [venues, setVenues] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newVenue, setNewVenue] = useState({ name: "", neighborhood: "", city: "Abu Dhabi", avg_spend_aed: 0 });

  const search = useCallback(async (query) => {
    const res = await fetch(`/api/admin/venues?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    if (!res.ok) { setErr(d.error); return; }
    setVenues(d.venues || []);
  }, []);

  useEffect(() => { search(""); }, [search]);

  async function patch(id, fields) {
    setBusy(true);
    const res = await fetch("/api/admin/venues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: fields }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error);
    else setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, ...fields } : v)));
    setBusy(false);
  }

  async function createVenue() {
    if (!newVenue.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newVenue),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(d.error); return; }
    setNewVenue({ name: "", neighborhood: "", city: "Abu Dhabi", avg_spend_aed: 0 });
    setCreating(false);
    search(q);
    setOpenId(d.id);
  }

  return (
    <div>
      <div className="field">
        <label>Search venues</label>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
          placeholder="Search by name…"
        />
      </div>

      <div className="card">
        {!creating ? (
          <button className="btn small" onClick={() => setCreating(true)}>+ Add a new venue</button>
        ) : (
          <>
            <strong style={{ fontSize: 14 }}>New venue</strong>
            <div className="field">
              <label>Name</label>
              <input type="text" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Neighborhood</label>
              <input type="text" value={newVenue.neighborhood} onChange={(e) => setNewVenue({ ...newVenue, neighborhood: e.target.value })} />
            </div>
            <div className="field">
              <label>City</label>
              <select value={newVenue.city} onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })}>
                <option>Abu Dhabi</option>
                <option>Dubai</option>
              </select>
            </div>
            <div className="field">
              <label>Avg spend (AED)</label>
              <input type="number" value={newVenue.avg_spend_aed} onChange={(e) => setNewVenue({ ...newVenue, avg_spend_aed: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <button className="btn small" disabled={busy} onClick={createVenue}>Create</button>{" "}
            <button className="btn small ghost" onClick={() => setCreating(false)}>Cancel</button>
          </>
        )}
      </div>

      {err && <div className="notice err">{err}</div>}

      {venues.map((v) => (
        <div className="card" key={v.id} style={v.is_active ? undefined : { opacity: 0.55 }}>
          <div className="admin-row">
            <div style={{ flex: 1 }}>
              <div className="venue-name">{v.name} {!v.is_active && <span className="tag-pill">inactive</span>}</div>
              <div className="venue-meta">{v.neighborhood} · {v.city} · {v.avg_spend_aed} AED{v.is_trending ? " · 🔥 trending" : ""}</div>
            </div>
            <div className="admin-actions">
              <button className="btn small ghost" onClick={() => setOpenId(openId === v.id ? null : v.id)}>
                {openId === v.id ? "Close" : "Edit"}
              </button>
              <button
                className={`btn small ${v.is_trending ? "" : "ghost"}`}
                disabled={busy}
                onClick={() => patch(v.id, { is_trending: !v.is_trending, trending_rank: v.is_trending ? null : 1 })}
              >
                {v.is_trending ? "🔥 Untrend" : "Mark trending"}
              </button>
              <button className="btn small ghost" disabled={busy} onClick={() => patch(v.id, { is_active: !v.is_active })}>
                {v.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </div>
          {openId === v.id && <VenueEditFields venue={v} onSave={(fields) => patch(v.id, fields)} busy={busy} />}
        </div>
      ))}
    </div>
  );
}

function VenueEditFields({ venue, onSave, busy }) {
  const [name, setName] = useState(venue.name || "");
  const [neighborhood, setNeighborhood] = useState(venue.neighborhood || "");
  const [city, setCity] = useState(venue.city || "Abu Dhabi");
  const [avgSpend, setAvgSpend] = useState(venue.avg_spend_aed ?? 0);
  const [description, setDescription] = useState(venue.description || "");
  const [heroVideo, setHeroVideo] = useState(venue.hero_video_url || "");
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);

  const loadMedia = useCallback(async () => {
    const res = await fetch(`/api/admin/venues/media?venueId=${venue.id}`);
    const d = await res.json();
    if (res.ok) setMedia(d.media || []);
  }, [venue.id]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("venueId", venue.id);
    form.append("file", file);
    await fetch("/api/admin/venues/media", { method: "POST", body: form });
    await loadMedia();
    setUploading(false);
  }

  async function removeMedia(id) {
    await fetch("/api/admin/venues/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadMedia();
  }

  return (
    <div style={{ marginTop: 14, borderTop: "2px solid var(--ink)", paddingTop: 14 }}>
      <div className="field">
        <label>Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Neighborhood / area</label>
        <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
      </div>
      <div className="field">
        <label>City</label>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option>Abu Dhabi</option>
          <option>Dubai</option>
        </select>
      </div>
      <div className="field">
        <label>Avg spend (AED)</label>
        <input type="number" value={avgSpend} onChange={(e) => setAvgSpend(parseInt(e.target.value, 10) || 0)} />
      </div>
      <div className="field">
        <label>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label>Hero video URL</label>
        <input type="url" value={heroVideo} onChange={(e) => setHeroVideo(e.target.value)} />
      </div>

      <div className="field">
        <label>Photos & videos</label>
        <div className="media-grid">
          {media.map((m) => (
            <div className="media-thumb" key={m.id}>
              {m.media_type === "video" ? (
                <video src={safeUrl(m.url)} muted />
              ) : (
                <img src={safeUrl(m.url)} alt="" />
              )}
              <button type="button" className="media-remove" onClick={() => removeMedia(m.id)}>✕</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*,video/*" onChange={uploadFile} disabled={uploading} />
      </div>

      <button
        className="btn small"
        disabled={busy}
        onClick={() =>
          onSave({
            name,
            neighborhood,
            city,
            avg_spend_aed: avgSpend,
            description,
            hero_video_url: heroVideo || null,
          })
        }
      >
        Save changes
      </button>
    </div>
  );
}
