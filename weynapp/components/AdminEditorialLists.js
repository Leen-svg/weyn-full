"use client";
import { useCallback, useEffect, useState } from "react";
import { safeUrl } from "@/lib/sanitize";

const blank = { id: null, title: "", subtitle: "", city: "Dubai", headerImageUrl: "", homeSection: "curated", sortOrder: 0, isPublished: false, venueIds: [] };

export default function AdminEditorialLists() {
  const [lists, setLists] = useState([]);
  const [venues, setVenues] = useState([]);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/editorial-lists");
    const body = await response.json();
    if (!response.ok) return setNotice(body.error || "Could not load Weyn lists.");
    setLists(body.lists || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/admin/venues?q=${encodeURIComponent(query)}`);
      const body = await response.json();
      if (response.ok) setVenues(body.venues || []);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function open(list = null) {
    setNotice("");
    setEditing(list ? {
      id: list.id, title: list.title, subtitle: list.subtitle || "", city: list.city,
      headerImageUrl: list.header_image_url || "", sortOrder: list.sort_order,
      homeSection: list.home_section || "curated",
      isPublished: list.is_published,
      venueIds: [...(list.editorial_list_items || [])].sort((a, b) => a.position - b.position).map((item) => item.venue_id),
    } : { ...blank, venueIds: [] });
  }

  function toggleVenue(id) {
    setEditing((current) => ({ ...current, venueIds: current.venueIds.includes(id) ? current.venueIds.filter((venueId) => venueId !== id) : [...current.venueIds, id] }));
  }

  function moveVenue(index, direction) {
    setEditing((current) => {
      const venueIds = [...current.venueIds];
      const target = index + direction;
      if (target < 0 || target >= venueIds.length) return current;
      [venueIds[index], venueIds[target]] = [venueIds[target], venueIds[index]];
      return { ...current, venueIds };
    });
  }

  async function save() {
    setBusy(true); setNotice("");
    const response = await fetch("/api/admin/editorial-lists", { method: editing.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "Could not save this list.");
    setEditing(null); setNotice("Weyn list saved."); await load();
  }

  async function remove(id) {
    if (!confirm("Delete this Weyn list? The venues will not be deleted.")) return;
    const response = await fetch("/api/admin/editorial-lists", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const body = await response.json();
    setNotice(response.ok ? "Weyn list deleted." : body.error || "Could not delete this list.");
    if (response.ok) await load();
  }

  const selectedVenue = (id) => venues.find((venue) => venue.id === id) || lists.flatMap((list) => list.editorial_list_items || []).find((item) => item.venue_id === id)?.venues;

  return <section className="admin-editorial">
    <div className="admin-row"><div><span className="eyebrow">Homepage editor</span><h2>Curated by Weyn lists</h2><p className="sub">Edit the list name, header image, city, order and every place inside it.</p></div><button className="btn primary" type="button" onClick={() => open()}>New Weyn list</button></div>
    {notice && <div className="notice">{notice}</div>}
    {editing && <div className="card editorial-editor">
      <div className="admin-row"><h3>{editing.id ? "Edit Weyn list" : "Create Weyn list"}</h3><button className="btn small ghost" onClick={() => setEditing(null)}>Close</button></div>
      <label className="field"><span>List name</span><input maxLength={100} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} placeholder="Weyn’s Cafes of the Week" /></label>
      <label className="field"><span>Fun intro</span><input maxLength={240} value={editing.subtitle} onChange={(event) => setEditing({ ...editing, subtitle: event.target.value })} placeholder="Fresh coffee, great corners and zero boring catch-ups." /></label>
      <label className="field"><span>Header image link</span><input inputMode="url" value={editing.headerImageUrl} onChange={(event) => setEditing({ ...editing, headerImageUrl: event.target.value })} placeholder="https://..." /></label>
      {safeUrl(editing.headerImageUrl) && <img className="editorial-image-preview" src={safeUrl(editing.headerImageUrl)} alt="Current list header preview" />}
      <div className="editorial-grid"><label className="field"><span>Homepage section</span><select value={editing.homeSection} onChange={(event) => setEditing({ ...editing, homeSection: event.target.value })}><option value="our_picks">Our picks</option><option value="curated">Curated collection</option></select></label><label className="field"><span>City</span><select value={editing.city} onChange={(event) => setEditing({ ...editing, city: event.target.value })}><option>Dubai</option><option>Abu Dhabi</option></select></label><label className="field"><span>Homepage order</span><input type="number" min="0" max="999" value={editing.sortOrder} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) })} /></label></div>
      <label className="toggle-row"><input type="checkbox" checked={editing.isPublished} onChange={(event) => setEditing({ ...editing, isPublished: event.target.checked })} /><span><strong>Published</strong><br/><small>Visible on the app homepage</small></span></label>
      <h3>Places in this list</h3>
      <div className="editorial-selected">{editing.venueIds.map((id, index) => { const venue = selectedVenue(id); return <div className="details-row" key={id}><span><strong>{index + 1}. {venue?.name || "Selected place"}</strong><small>{venue?.neighborhood || venue?.city || ""}</small></span><div><button className="btn small ghost" type="button" disabled={index === 0} onClick={() => moveVenue(index, -1)} aria-label={`Move ${venue?.name || "place"} up`}>↑</button><button className="btn small ghost" type="button" disabled={index === editing.venueIds.length - 1} onClick={() => moveVenue(index, 1)} aria-label={`Move ${venue?.name || "place"} down`}>↓</button><button className="btn small ghost" type="button" onClick={() => toggleVenue(id)}>Remove</button></div></div>; })}</div>
      <label className="field"><span>Find places</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search venue name" /></label>
      <div className="editorial-venue-picker">{venues.map((venue) => <label className="toggle-row" key={venue.id}><input type="checkbox" checked={editing.venueIds.includes(venue.id)} onChange={() => toggleVenue(venue.id)} /><span><strong>{venue.name}</strong><br/><small>{venue.neighborhood || venue.city}</small></span></label>)}</div>
      <button className="btn primary btn-full" disabled={busy || !editing.title.trim()} onClick={save}>{busy ? "Saving..." : "Save Weyn list"}</button>
    </div>}
    <div className="editorial-list-admin">{lists.map((list) => <article className="card" key={list.id}><div className="admin-row"><div><span className={`saved-visibility ${list.is_published ? "public" : "private"}`}>{list.is_published ? "published" : "draft"}</span><h3>{list.title}</h3><p className="sub">{list.home_section === "our_picks" ? "Our picks" : "Curated"} · {list.city} · {(list.editorial_list_items || []).length} places · order {list.sort_order}</p></div><div className="admin-actions"><button className="btn small" onClick={() => open(list)}>Edit</button><button className="btn small ghost" onClick={() => remove(list.id)}>Delete</button></div></div></article>)}</div>
  </section>;
}
