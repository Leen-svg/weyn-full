"use client";
import { useState, useEffect, useCallback } from "react";

export default function AdminCuratedLists() {
  const [lists, setLists] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [searchByList, setSearchByList] = useState({});
  const [resultsByList, setResultsByList] = useState({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/curated-lists");
    const d = await res.json();
    if (res.ok) setLists(d.lists || []);
    else setErr(d.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createList() {
    if (!newTitle.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/curated-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, description: newDescription }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error);
    else { setNewTitle(""); setNewDescription(""); await load(); }
    setBusy(false);
  }

  async function toggleActive(list) {
    setBusy(true);
    await fetch(`/api/admin/curated-lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !list.is_active }),
    });
    setBusy(false);
    load();
  }

  async function renameList(list) {
    const title = prompt("List title", list.title);
    if (title === null || !title.trim()) return;
    const description = prompt("Description (optional)", list.description || "") ?? list.description;
    setBusy(true);
    await fetch(`/api/admin/curated-lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setBusy(false);
    load();
  }

  async function deleteList(list) {
    if (!confirm(`Delete "${list.title}"? This can't be undone.`)) return;
    setBusy(true);
    await fetch(`/api/admin/curated-lists/${list.id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  async function searchVenues(listId, query) {
    setSearchByList((prev) => ({ ...prev, [listId]: query }));
    if (query.trim().length < 2) {
      setResultsByList((prev) => ({ ...prev, [listId]: [] }));
      return;
    }
    const res = await fetch(`/api/venues/search?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    setResultsByList((prev) => ({ ...prev, [listId]: res.ok ? d.results || [] : [] }));
  }

  async function addVenue(listId, venueId) {
    setBusy(true);
    await fetch(`/api/admin/curated-lists/${listId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId }),
    });
    setSearchByList((prev) => ({ ...prev, [listId]: "" }));
    setResultsByList((prev) => ({ ...prev, [listId]: [] }));
    setBusy(false);
    load();
  }

  async function removeVenue(listId, venueId) {
    setBusy(true);
    await fetch(`/api/admin/curated-lists/${listId}/venues?venueId=${venueId}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  return (
    <>
      <div className="card">
        <h2>New curated list</h2>
        <p className="sub">Editorial collections shown to every user, e.g. &ldquo;Weyn&apos;s picks&rdquo; or &ldquo;Best rooftops&rdquo;.</p>
        <div className="field">
          <label htmlFor="curated-title">Title</label>
          <input type="text" id="curated-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Best rooftops in Abu Dhabi" />
        </div>
        <div className="field">
          <label htmlFor="curated-desc">Description (optional)</label>
          <input type="text" id="curated-desc" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Sundowners worth the drive" />
        </div>
        <button className="btn small" disabled={busy || !newTitle.trim()} onClick={createList}>Create list</button>
      </div>

      {err && <div className="notice err">{err}</div>}

      {lists.length === 0 && <p className="sub">No curated lists yet.</p>}

      {lists.map((list) => (
        <div className="card" key={list.id}>
          <div className="admin-row">
            <div>
              <div className="venue-name">{list.title} {!list.is_active && <span className="tag-pill">Hidden</span>}</div>
              {list.description && <div className="venue-meta">{list.description}</div>}
              <div className="mono">{list.venues.length} place{list.venues.length === 1 ? "" : "s"}</div>
            </div>
            <div className="admin-actions">
              <button className="btn small ghost" disabled={busy} onClick={() => renameList(list)}>Edit</button>
              <button className="btn small ghost" disabled={busy} onClick={() => toggleActive(list)}>{list.is_active ? "Hide" : "Show"}</button>
              <button className="btn small ghost" disabled={busy} onClick={() => deleteList(list)}>Delete</button>
            </div>
          </div>

          {list.venues.length > 0 && (
            <div className="tag-row">
              {list.venues.map((venue) => (
                <span className="tag-pill" key={venue.id}>
                  {venue.name}
                  <button type="button" onClick={() => removeVenue(list.id, venue.id)} aria-label={`Remove ${venue.name}`} style={{ marginLeft: 6, cursor: "pointer" }}>×</button>
                </span>
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: 12, position: "relative" }}>
            <label htmlFor={`curated-search-${list.id}`}>Add a place</label>
            <input
              type="text"
              id={`curated-search-${list.id}`}
              value={searchByList[list.id] || ""}
              onChange={(e) => searchVenues(list.id, e.target.value)}
              placeholder="Search venues by name…"
            />
            {(resultsByList[list.id] || []).length > 0 && (
              <div className="card" style={{ marginTop: 6, padding: 8 }}>
                {resultsByList[list.id].map((venue) => (
                  <button
                    key={venue.id}
                    type="button"
                    className="btn small ghost block"
                    style={{ justifyContent: "flex-start", marginBottom: 4 }}
                    onClick={() => addVenue(list.id, venue.id)}
                  >
                    {venue.name} <span className="mono">· {venue.neighborhood}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
