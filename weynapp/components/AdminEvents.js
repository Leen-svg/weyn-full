"use client";
import { useCallback, useEffect, useState } from "react";
import { EVENT_WEEKDAYS, recurrenceLabel } from "@/lib/events.mjs";
import { safeUrl } from "@/lib/sanitize";
import { compressImage } from "@/lib/image-compress";
import { createClient } from "@/lib/supabase/client";

const TYPES = [["party", "Party"], ["club-night", "Club night"], ["live-music", "Live music"], ["ladies-night", "Ladies' night"], ["brunch", "Brunch"], ["other", "Other"]];
const blank = {
  id: null, title: "", description: "", venueId: "", city: "Dubai", location: "",
  startsOn: "", endsOn: "", startTime: "", endTime: "", recurrenceType: "one_time", recurrenceDays: [],
  ageRestriction: "21-plus", eventType: "party", imageUrl: "", ticketUrl: "", websiteUrl: "", socialUrl: "",
  instagramEmbed: "", reservationPhone: "", priceFromAed: "", sortOrder: 0, isTrending: false, isTryThisOut: false,
};

async function uploadEventCover(file) {
  const compressed = await compressImage(file);
  const signResponse = await fetch("/api/admin/events/cover", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent: "sign", contentType: compressed.type, fileSize: compressed.size }),
  });
  const signed = await signResponse.json();
  if (!signResponse.ok) throw new Error(signed.error || "Could not start the image upload");
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from("venue-media").uploadToSignedUrl(signed.path, signed.token, compressed, { contentType: compressed.type });
  if (uploadError) throw uploadError;
  const completeResponse = await fetch("/api/admin/events/cover", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent: "complete", path: signed.path }),
  });
  const completed = await completeResponse.json();
  if (!completeResponse.ok) throw new Error(completed.error || "Could not finish the image upload");
  return completed.url;
}

function dubaiDateTime(value) {
  if (!value) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, time: `${fields.hour}:${fields.minute}` };
}

function toEditor(event) {
  if (!event.is_active && event.draft_data && Object.keys(event.draft_data).length) {
    return { ...blank, ...event.draft_data, id: event.id, recurrenceDays: (event.draft_data.recurrenceDays || []).map(Number) };
  }
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
    instagramEmbed: event.instagram_post_url || "",
    priceFromAed: event.price_from_aed ?? "", sortOrder: event.sort_order || 0,
    isTrending: !!event.is_trending, isTryThisOut: !!event.is_try_this_out,
  };
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venueQuery, setVenueQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

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
    setNotice(""); setError(""); setVenueQuery(event?.venues?.name || ""); setUploadStatus("");
    setSelectedVenue(event?.venues || null);
    setEditing(event ? toEditor(event) : { ...blank, recurrenceDays: [], sortOrder: events.length });
  }

  async function handleCoverFile(file) {
    if (!file || uploadingCover) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Choose a JPG, PNG, or WebP image.");
    setUploadingCover(true); setUploadStatus("Optimizing and uploading image…"); setError("");
    try {
      const url = await uploadEventCover(file);
      setEditing((current) => ({ ...current, imageUrl: url }));
      setUploadStatus("Image uploaded and ready to save.");
    } catch (uploadError) {
      setUploadStatus(""); setError(uploadError.message || "Could not upload this image.");
    } finally {
      setUploadingCover(false);
    }
  }

  function onCoverChosen(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    handleCoverFile(file);
  }
  const setField = (field, value) => setEditing((current) => ({ ...current, [field]: value }));
  function toggleDay(day) {
    setEditing((current) => ({ ...current, recurrenceDays: current.recurrenceDays.includes(day) ? current.recurrenceDays.filter((value) => value !== day) : [...current.recurrenceDays, day].sort() }));
  }

  async function save(intent) {
    setBusy(true); setNotice(""); setError("");
    const response = await fetch("/api/admin/events", { method: editing.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...editing, intent }) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) return setError(body.error || "Could not save this event.");
    setEditing(null); setNotice(intent === "publish" ? "Event published." : "Draft saved — finish it whenever you’re ready."); await load();
  }

  function chooseVenue(venue) {
    setSelectedVenue(venue); setField("venueId", venue.id); setVenueQuery(venue.name);
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

    {editing && <form className="card event-editor" onSubmit={(event) => { event.preventDefault(); save("draft"); }} noValidate>
      <div className="admin-row"><h3>{editing.id ? "Edit event" : "Create event"}</h3><button className="btn small ghost" type="button" onClick={() => setEditing(null)}>Close</button></div>
      <label className="field"><span>Event name</span><input type="text" maxLength="160" value={editing.title} onChange={(e) => setField("title", e.target.value)} placeholder="Friday Rooftop Sessions" /></label>
      <label className="field"><span>Description</span><textarea maxLength="1000" value={editing.description} onChange={(e) => setField("description", e.target.value)} placeholder="What makes this worth going to?" /></label>
      <label className={`event-cover-upload ${uploadingCover ? "is-uploading" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleCoverFile(e.dataTransfer.files?.[0]); }}>
        <strong>{uploadingCover ? "Uploading event image…" : "Drop an event image here"}</strong>
        <span>or press to choose a JPG, PNG, or WebP file</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingCover} onChange={onCoverChosen} />
      </label>
      {uploadStatus && <div className="media-upload-status" role="status">{uploadStatus}</div>}
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
      <label className="field"><span>Instagram carousel embed code or post link</span><textarea value={editing.instagramEmbed} onChange={(e) => setField("instagramEmbed", e.target.value)} placeholder={'Paste the full Instagram embed code or https://www.instagram.com/p/…/'} /><small>Weyn safely extracts the post link and shows the official swipeable carousel when someone expands this event.</small></label>

      <fieldset className="event-schedule"><legend>Schedule</legend>
        <div className="event-form-grid event-form-grid--schedule">
          <label className="field"><span>Repeats</span><select value={editing.recurrenceType} onChange={(e) => setField("recurrenceType", e.target.value)}><option value="one_time">Does not repeat</option><option value="weekly">Every week</option></select></label>
          <label className="field"><span>{editing.recurrenceType === "weekly" ? "Starts on" : "Event date"}</span><input type="date" value={editing.startsOn} onChange={(e) => setField("startsOn", e.target.value)} /></label>
          <label className="field"><span>Start time</span><input type="time" value={editing.startTime} onChange={(e) => setField("startTime", e.target.value)} /></label>
          <label className="field"><span>End time</span><input type="time" value={editing.endTime} onChange={(e) => setField("endTime", e.target.value)} /></label>
        </div>
        {editing.recurrenceType === "weekly" && <>
          <div className="field"><span>Repeat on *</span><div className="weekday-picker" role="group" aria-label="Days this event repeats">{EVENT_WEEKDAYS.map((day) => <button key={day.value} type="button" className={`chip ${editing.recurrenceDays.includes(day.value) ? "sel" : ""}`} aria-pressed={editing.recurrenceDays.includes(day.value)} onClick={() => toggleDay(day.value)}>{day.short}</button>)}</div></div>
          <label className="field"><span>Stop repeating</span><input type="date" min={editing.startsOn || undefined} value={editing.endsOn} onChange={(e) => setField("endsOn", e.target.value)} /><small>Optional — leave blank to keep it running every week.</small></label>
        </>}
      </fieldset>

      <div className="field"><span>Linked venue from your Weyn catalog</span>
        {editing.venueId && selectedVenue && <div className="event-selected-venue"><span><strong>{selectedVenue.name}</strong><small>{selectedVenue.neighborhood || selectedVenue.city || "Weyn venue"}</small></span><button className="btn small ghost" type="button" onClick={() => { setSelectedVenue(null); setField("venueId", ""); setVenueQuery(""); }}>Remove</button></div>}
        <input type="search" value={venueQuery} onChange={(e) => setVenueQuery(e.target.value)} placeholder="Search places you already added…" />
        <div className="event-venue-results" role="listbox" aria-label="Existing Weyn venues">{venues.slice(0, 20).map((venue) => <button key={venue.id} className={editing.venueId === venue.id ? "is-selected" : ""} type="button" role="option" aria-selected={editing.venueId === venue.id} onClick={() => chooseVenue(venue)}><strong>{venue.name}</strong><small>{venue.neighborhood || venue.city}</small></button>)}</div>
        {!venues.length && venueQuery && <small>No matching catalog venue. Try a shorter part of its exact Weyn name.</small>}
        <small>Search and press an existing venue to link it. Required for club events to appear in Weyn Tonight.</small>
      </div>
      <div className="event-form-grid">
        <label className="field"><span>Type</span><select value={editing.eventType} onChange={(e) => setField("eventType", e.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="field"><span>Age</span><select value={editing.ageRestriction} onChange={(e) => setField("ageRestriction", e.target.value)}><option value="all-ages">All ages</option><option value="18-plus">18+</option><option value="21-plus">21+</option></select></label>
        <label className="field"><span>From (AED)</span><input type="number" min="0" value={editing.priceFromAed} onChange={(e) => setField("priceFromAed", e.target.value)} /></label>
      </div>
      <div className="event-toggle-grid event-toggle-grid--badges">
        <label className="toggle-row"><input type="checkbox" checked={editing.isTrending} onChange={(e) => setField("isTrending", e.target.checked)} /><span><strong>🔥 Trending</strong><small>Add the Trending sign</small></span></label>
        <label className="toggle-row"><input type="checkbox" checked={editing.isTryThisOut} onChange={(e) => setField("isTryThisOut", e.target.checked)} /><span><strong>✨ Try this out</strong><small>Add the Try this out sign</small></span></label>
      </div>
      <div className="event-save-actions"><button className="btn ghost" disabled={busy || uploadingCover} type="submit">{busy ? "Saving…" : "Save draft"}</button><button className="btn primary" disabled={busy || uploadingCover} type="button" onClick={() => save("publish")}>{busy ? "Saving…" : "Publish event"}</button></div>
      <p className="event-save-help">Drafts can be incomplete and stay hidden. Publishing checks the event name, date, schedule, and links.</p>
    </form>}

    <div className="event-admin-list">{events.length === 0 && !error ? <div className="discover-empty">No events yet. Create the first one above.</div> : events.map((item, index) => <article className="card event-admin-card" key={item.id}>
      {safeUrl(item.cover_image_url) && <img src={safeUrl(item.cover_image_url)} alt="" />}
      <div className="event-admin-card__body"><div className="event-badges">{item.is_trending && <span className="event-badge event-badge--trending">🔥 Trending</span>}{item.is_try_this_out && <span className="event-badge event-badge--try">✨ Try this out</span>}<span className={`saved-visibility ${item.is_active ? "public" : "private"}`}>{item.is_active ? "published" : "draft"}</span></div><h3>{item.title || item.draft_data?.title || "Untitled event"}</h3><p className="venue-meta">{item.starts_at ? `${recurrenceLabel({ recurrence_type: item.recurrence === "weekly" ? "weekly" : "one_time", recurrence_days: item.recurrence_days })} · ${dubaiDateTime(item.starts_at).date}` : "Date not added yet"}{item.neighborhood ? ` · ${item.neighborhood}` : ""}{item.venues?.name ? ` · ${item.venues.name}` : ""}</p></div>
      <div className="admin-actions event-order-actions"><button className="btn small ghost" type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${item.title} up`}>↑</button><button className="btn small ghost" type="button" disabled={busy || index === events.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${item.title} down`}>↓</button><button className="btn small" type="button" disabled={busy} onClick={() => open(item)}>Edit</button><button className="btn small ghost" type="button" disabled={busy} onClick={() => remove(item.id)}>Delete</button></div>
    </article>)}</div>
  </section>;
}
