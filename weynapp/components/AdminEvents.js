"use client";
import { useCallback, useEffect, useState } from "react";

const blank = {
  id: null, title: "", description: "", venueId: "", city: "Dubai", neighborhood: "",
  startsAt: "", endsAt: "", ageRestriction: "21-plus", eventType: "party",
  coverImageUrl: "", ticketUrl: "", priceFromAed: "", isActive: true,
  recurrence: "none", recurrenceUntil: "",
};

const TYPES = [
  ["party", "Party"],
  ["club-night", "Club night"],
  ["live-music", "Live music"],
  ["ladies-night", "Ladies' night"],
  ["brunch", "Brunch"],
  ["other", "Other"],
];

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/events");
    const body = await res.json();
    if (!res.ok) return setNotice(body.error || "Could not load events.");
    setEvents(body.events || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/venues?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (res.ok) setVenues(body.venues || []);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function open(event = null) {
    setNotice("");
    setEditing(event ? {
      id: event.id,
      title: event.title,
      description: event.description || "",
      venueId: event.venue_id || "",
      city: event.city,
      neighborhood: event.neighborhood || "",
      startsAt: toLocalInput(event.starts_at),
      endsAt: toLocalInput(event.ends_at),
      ageRestriction: event.age_restriction,
      eventType: event.event_type,
      coverImageUrl: event.cover_image_url || "",
      ticketUrl: event.ticket_url || "",
      priceFromAed: event.price_from_aed ?? "",
      isActive: event.is_active,
      recurrence: event.recurrence || "none",
      recurrenceUntil: event.recurrence_until || "",
    } : { ...blank });
  }

  async function save() {
    setBusy(true); setNotice("");
    const res = await fetch("/api/admin/events", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editing),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setNotice(body.error || "Could not save this event.");
    setEditing(null); setNotice("Event saved."); await load();
  }

  async function remove(id) {
    if (!confirm("Delete this event?")) return;
    const res = await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await res.json();
    setNotice(res.ok ? "Event deleted." : body.error || "Could not delete.");
    if (res.ok) await load();
  }

  const set = (patch) => setEditing((current) => ({ ...current, ...patch }));
  // A weekly series is only expired once it has no occurrence left, which is
  // exactly what a null next_start means.
  const isExpired = (e) => !e.next_start;

  return (
    <section className="admin-editorial">
      <div className="admin-row">
        <div>
          <span className="eyebrow">Nightlife</span>
          <h2>Events &amp; parties</h2>
          <p className="sub">
            Dated inventory for the 21+ section. Events disappear from the app automatically once they end — expired ones
            stay listed here so you can see what needs refreshing.
          </p>
        </div>
        <button className="btn primary" type="button" onClick={() => open()}>New event</button>
      </div>
      {notice && <div className="notice">{notice}</div>}

      {editing && (
        <div className="card editorial-editor">
          <div className="admin-row">
            <h3>{editing.id ? "Edit event" : "Create event"}</h3>
            <button className="btn small ghost" onClick={() => setEditing(null)}>Close</button>
          </div>

          <label className="field"><span>Title</span>
            <input type="text" maxLength={160} value={editing.title} onChange={(e) => set({ title: e.target.value })} placeholder="Friday: Resident DJ" />
          </label>
          <label className="field"><span>Description</span>
            <input type="text" maxLength={1000} value={editing.description} onChange={(e) => set({ description: e.target.value })} placeholder="What actually happens on the night" />
          </label>

          <div className="editorial-grid">
            <label className="field"><span>Starts</span>
              <input type="datetime-local" value={editing.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
            </label>
            <label className="field"><span>Ends (optional)</span>
              <input type="datetime-local" value={editing.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
            </label>
            <label className="field"><span>Type</span>
              <select value={editing.eventType} onChange={(e) => set({ eventType: e.target.value })}>
                {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <div className="editorial-grid">
            <label className="field"><span>Age</span>
              <select value={editing.ageRestriction} onChange={(e) => set({ ageRestriction: e.target.value })}>
                <option value="all-ages">All ages</option>
                <option value="18-plus">18+</option>
                <option value="21-plus">21+</option>
              </select>
            </label>
            <label className="field"><span>City</span>
              <select value={editing.city} onChange={(e) => set({ city: e.target.value })}>
                <option>Dubai</option><option>Abu Dhabi</option>
              </select>
            </label>
            <label className="field"><span>From (AED)</span>
              <input type="number" min="0" value={editing.priceFromAed} onChange={(e) => set({ priceFromAed: e.target.value })} />
            </label>
          </div>

          <div className="editorial-grid">
            <label className="field"><span>Repeats</span>
              <select value={editing.recurrence} onChange={(e) => set({ recurrence: e.target.value })}>
                <option value="none">One-off</option>
                <option value="weekly">Every week</option>
              </select>
            </label>
            {editing.recurrence === "weekly" && (
              <label className="field"><span>Repeat until</span>
                <input type="date" value={editing.recurrenceUntil} onChange={(e) => set({ recurrenceUntil: e.target.value })} />
              </label>
            )}
          </div>
          {editing.recurrence === "weekly" && (
            <p className="sub">
              Set the start to the <strong>first</strong> occurrence. Weyn shows whichever week is next and drops the
              series after the repeat-until date.
            </p>
          )}

          <label className="field"><span>Venue (optional)</span>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search venue name" />
          </label>
          <select className="field" value={editing.venueId} onChange={(e) => set({ venueId: e.target.value })}>
            <option value="">No venue / pop-up</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.neighborhood || v.city}</option>)}
          </select>

          <label className="field"><span>Cover image link</span>
            <input type="text" inputMode="url" value={editing.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} placeholder="https://..." />
          </label>
          <label className="field"><span>Ticket link</span>
            <input type="text" inputMode="url" value={editing.ticketUrl} onChange={(e) => set({ ticketUrl: e.target.value })} placeholder="https://..." />
          </label>

          <label className="toggle-row">
            <input type="checkbox" checked={editing.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
            <span><strong>Published</strong><br /><small>Visible in the app while it hasn&apos;t ended</small></span>
          </label>

          <button className="btn primary btn-full" disabled={busy || !editing.title.trim() || !editing.startsAt} onClick={save}>
            {busy ? "Saving..." : "Save event"}
          </button>
        </div>
      )}

      <div className="editorial-list-admin">
        {events.length === 0 && <div className="discover-empty">No events yet. Add the first one.</div>}
        {events.map((event) => (
          <article className="card" key={event.id}>
            <div className="admin-row">
              <div>
                <span className={`saved-visibility ${event.is_active && !isExpired(event) ? "public" : "private"}`}>
                  {isExpired(event) ? "expired" : event.is_active ? "live" : "draft"}
                </span>
                <h3>{event.title}</h3>
                <p className="sub">
                  {new Date(event.next_start || event.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  {event.recurrence === "weekly" ? " · weekly" : ""}
                  {" · "}{event.age_restriction === "21-plus" ? "21+" : event.age_restriction === "18-plus" ? "18+" : "All ages"}
                  {" · "}{event.city}
                  {event.venues?.name ? ` · ${event.venues.name}` : ""}
                </p>
              </div>
              <div className="admin-actions">
                <button className="btn small" onClick={() => open(event)}>Edit</button>
                <button className="btn small ghost" onClick={() => remove(event.id)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
