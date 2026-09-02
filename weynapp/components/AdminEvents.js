"use client";
import { useCallback, useEffect, useState } from "react";
import { EVENT_WEEKDAYS, recurrenceLabel } from "@/lib/events.mjs";
import { safeUrl } from "@/lib/sanitize";

const TYPES = [["party", "Party"], ["club-night", "Club night"], ["live-music", "Live music"], ["ladies-night", "Ladies' night"], ["brunch", "Brunch"], ["other", "Other"]];
const blank = {
  id: null, title: "", description: "", venueId: "", city: "Dubai", location: "",
  startsOn: "", endsOn: "", startTime: "", endTime: "", recurrenceType: "one_time", recurrenceDays: [],
  ageRestriction: "21-plus", eventType: "party", imageUrl: "", ticketUrl: "", websiteUrl: "", socialUrl: "",
  reservationPhone: "", priceFromAed: "", sortOrder: 0, isTrending: false, isTryThisOut: false, isPublished: true,
};

function dubaiDateTime(value) {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}` };
}

function toEditor(event) {
  const start = dubaiDateTime(event.starts_at);
  const end = dubaiDateTime(event.ends_at);
  return {
    id: event.id, title: event.title || "", description: event.description || "", venueId: event.venue_id || "",
    city: event.city || "Dubai", location: event.neighborhood || "", startsOn: start.date,
    endsOn: event.recurrence_until || "", startTime: start.time, endTime: end.time,
    recurrenceType: event.recurrence === "weekly" ? "weekly" : "one_time",
    recurrenceDays: (event.recurrence_days || []).map(Number), ageRestriction: event.age_restriction || "21-plus",
    eventType: event.event_type || "party", imageUrl: event.cover_image_url || "", ticketUrl: event.ticket_url || "",
    websiteUrl: event.website_url || "", socialUrl: event.social_url || "", reservationPhone: event.reservation_phone || "",
    priceFromAed: event.price_from_aed ?? "", sortOrder: event.sort_order || 0,
    isTrending: !!event.is_trending, isTryThisOut: !!event.is_try_this_out, isPublished: !!event.is_active,
  };
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [venueQuery, setVenueQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/events");
    const body = await response.json();
    if (!response.ok) return setError(body.error || "Could not load events.");
    setEvents(body.events || []); setError("");
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/admin/venues?q=${encodeURIComponent(venueQuery)}`);
      const body = await response.json();
      if (response.ok) setVenues(body.venues || []);
    }, 220);
    return () => clearTimeout(timer);
  }, [venueQuery]);

  function open(event = null) {
    setNotice(""); setError(""); setVenueQuery("");
    setEditing(event ? toEditor(event) : { ...blank, recurrenceDays: [], sortOrder: events.length });
  }
  const setField = (field, value) => setEditing((current) => ({ ...current, [field]: value }));
  function toggleDay(day) {
    setEditing((current) => ({ ...current, recurrenceDays: current.recurrenceDays.includes(day) ? current.recurrenceDays.filter((value) => value !== day) : [...current.recurrenceDays, day].sort() }));
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    const response = await fetch("/api/admin/events", { method: editing.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error || "Could not save this event.");
    setEditing(null); setNotice("Event saved."); await load();
  }

  async function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= events.length || busy) return;
    const previous = events; const next = [...events];
    [next[index], next[target]] = [next[target], next[index]];
    setEvents(next); setBusy(true); setError("");
    const response = await fetch("/api/admin/events", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ order: next.map((item) => item.id) }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setEvents(previous); return setError(body.error || "Could not save event order."); }
    setNotice("Event order saved."); await load();
  }

  async function remove(id) {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setBusy(true); setError("");
    const response = await fetch("/api/admin/events", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error || "Could not delete this event.");
    setNotice("Event deleted."); await load();
  }

  return <section className="admin-events">
    <div className="admin-row">
      <div><span className="eyebrow">Events editor</span><h2>What&apos;s happening</h2><p className="sub">Create events, repeat them on specific weekdays, and control their order in Weyn.</p></div>
      <button className="btn primary" type="button" onClick={() => open()}>New event</button>
    </div>
    {notice && <div className="notice">{notice}</div>}{error && <div className="notice err">{error}</div>}

    {editing && <form className="card event-editor" onSubmit={save}>
      <div className="admin-row"><h3>{editing.id ? "Edit event" : "Create event"}</h3><button className="btn small ghost" type="button" onClick={() => setEditing(null)}>Close</button></div>
      <label className="field"><span>Event name *</span><input type="text" maxLength="160" required value={editing.title} onChange={(e) => setField("title", e.target.value)} placeholder="Friday Rooftop Sessions" /></label>
      <label className="field"><span>Description</span><textarea maxLength="1000" value={editing.description} onChange={(e) => setField("description", e.target.value)} placeholder="What makes this worth going to?" /></label>
      <label className="field"><span>Cover image link</span><input type="url" value={editing.imageUrl} onChange={(e) => setField("imageUrl", e.target.value)} placeholder="https://..." /></label>
      {safeUrl(editing.imageUrl) && <img className="event-image-preview" src={safeUrl(editing.imageUrl)} alt="Event cover preview" />}

      <div className="event-form-grid">
        <label className="field"><span>Location</span><input type="text" maxLength="180" value={editing.location} onChange={(e) => setField("location", e.target.value)} placeholder="Venue, area, city" /></label>
        <label className="field"><span>City</span><select value={editing.city} onChange={(e) => setField("city", e.target.value)}><option>Dubai</option><option>Abu Dhabi</option></select></label>
        <label className="field"><span>Reservation number</span><input type="tel" maxLength="40" value={editing.reservationPhone} onChange={(e) => setField("reservationPhone", e.target.value)} placeholder="+971 50 123 4567" /></label>
        <label className="field"><span>Website link</span><input type="url" value={editing.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} placeholder="https://..." /></label>
        <label className="field"><span>Social media link</span><input type="url" value={editing.socialUrl} onChange={(e) => setField("socialUrl", e.target.value)} placeholder="https://instagram.com/..." /></label>
        <label className="field"><span>Booking / ticket link</span><input type="url" value={editing.ticketUrl} onChange={(e) => setField("ticketUrl", e.target.value)} placeholder="https://..." /></label>
      </div>

      <fieldset className="event-schedule"><legend>Schedule</legend>
        <div className="event-form-grid event-form-grid--schedule">
          <label className="field"><span>Repeats</span><select value={editing.recurrenceType} onChange={(e) => setField("recurrenceType", e.target.value)}><option value="one_time">Does not repeat</option><option value="weekly">Every week</option></select></label>
          <label className="field"><span>{editing.recurrenceType === "weekly" ? "Starts on" : "Event date"} *</span><input type="date" required value={editing.startsOn} onChange={(e) => setField("startsOn", e.target.value)} /></label>
          <label className="field"><span>Start time</span><input type="time" value={editing.startTime} onChange={(e) => setField("startTime", e.target.value)} /></label>
          <label className="field"><span>End time</span><input type="time" value={editing.endTime} onChange={(e) => setField("endTime", e.target.value)} /></label>
        </div>
        {editing.recurrenceType === "weekly" && <>
          <div className="field"><span>Repeat on *</span><div className="weekday-picker" role="group" aria-label="Days this event repeats">{EVENT_WEEKDAYS.map((day) => <button key={day.value} type="button" className={`chip ${editing.recurrenceDays.includes(day.value) ? "sel" : ""}`} aria-pressed={editing.recurrenceDays.includes(day.value)} onClick={() => toggleDay(day.value)}>{day.short}</button>)}</div></div>
          <label className="field"><span>Stop repeating</span><input type="date" min={editing.startsOn || undefined} value={editing.endsOn} onChange={(e) => setField("endsOn", e.target.value)} /><small>Optional — leave blank to keep it running every week.</small></label>
        </>}
      </fieldset>

      <label className="field"><span>Linked venue</span><input type="text" value={venueQuery} onChange={(e) => setVenueQuery(e.target.value)} placeholder="Search venue name" /><select value={editing.venueId} onChange={(e) => setField("venueId", e.target.value)}><option value="">No linked venue / pop-up</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.neighborhood || v.city}</option>)}</select><small>Required for club events to appear in Weyn Tonight. Pressing the event card will reveal this venue.</small></label>
      <div className="event-form-grid">
        <label className="field"><span>Type</span><select value={editing.eventType} onChange={(e) => setField("eventType", e.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Age</span><select value={editing.ageRestriction} onChange={(e) => setField("ageRestriction", e.target.value)}><option value="all-ages">All ages</option><option value="18-plus">18+</option><option value="21-plus">21+</option></select></label>
        <label className="field"><span>From (AED)</span><input type="number" min="0" value={editing.priceFromAed} onChange={(e) => setField("priceFromAed", e.target.value)} /></label>
      </div>
      <div className="event-toggle-grid">
        <label className="toggle-row"><input type="checkbox" checked={editing.isPublished} onChange={(e) => setField("isPublished", e.target.checked)} /><span><strong>Published</strong><small>Visible in the app</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={editing.isTrending} onChange={(e) => setField("isTrending", e.target.checked)} /><span><strong>🔥 Trending</strong><small>Add the Trending sign</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={editing.isTryThisOut} onChange={(e) => setField("isTryThisOut", e.target.checked)} /><span><strong>✨ Try this out</strong><small>Add the Try this out sign</small></span></label>
      </div>
      <button className="btn primary btn-full" disabled={busy || !editing.title.trim() || !editing.startsOn} type="submit">{busy ? "Saving…" : "Save event"}</button>
    </form>}

    <div className="event-admin-list">{events.length === 0 && !error ? <div className="discover-empty">No events yet. Create the first one above.</div> : events.map((item, index) => <article className="card event-admin-card" key={item.id}>
      {safeUrl(item.cover_image_url) && <img src={safeUrl(item.cover_image_url)} alt="" />}
      <div className="event-admin-card__body"><div className="event-badges">{item.is_trending && <span className="event-badge event-badge--trending">🔥 Trending</span>}{item.is_try_this_out && <span className="event-badge event-badge--try">✨ Try this out</span>}<span className={`saved-visibility ${item.is_active ? "public" : "private"}`}>{item.is_active ? "published" : "draft"}</span></div><h3>{item.title}</h3><p className="venue-meta">{recurrenceLabel({ recurrence_type: item.recurrence === "weekly" ? "weekly" : "one_time", recurrence_days: item.recurrence_days })} · {dubaiDateTime(item.starts_at).date}{item.neighborhood ? ` · ${item.neighborhood}` : ""}</p></div>
      <div className="admin-actions event-order-actions"><button className="btn small ghost" type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.title} up`}>↑</button><button className="btn small ghost" type="button" disabled={busy || index === events.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${item.title} down`}>↓</button><button className="btn small" type="button" disabled={busy} onClick={() => open(item)}>Edit</button><button className="btn small ghost" type="button" disabled={busy} onClick={() => remove(item.id)}>Delete</button></div>
    </article>)}</div>
  </section>;
}
