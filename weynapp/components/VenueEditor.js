"use client";
import { useState, useEffect, useCallback } from "react";
import { safeUrl } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_EDGE = 1600;
const MAX_COMPRESSED_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const EMPTY_VENUE = {
  placeId: "", name: "", neighborhood: "", city: "Abu Dhabi", avg_spend_aed: 0,
  description: "", google_maps_url: "", hero_video_url: "", latitude: null, longitude: null,
  age_restriction: "all-ages", is_aesthetic: false, is_trending: false,
};

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const maxSourceEdge = Math.max(bitmap.width, bitmap.height);
  let targetEdge = MAX_IMAGE_EDGE;
  let quality = 0.8;
  let blob;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = Math.min(1, targetEdge / maxSourceEdge);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise((resolve, reject) =>
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not compress image")), "image/webp", quality)
    );
    if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
    targetEdge = Math.round(targetEdge * 0.82);
    quality = Math.max(0.62, quality - 0.06);
  }
  bitmap.close();
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

async function uploadVenueFile(venueId, source) {
  if (!source.type.startsWith("image/") && !source.type.startsWith("video/")) throw new Error(`${source.name} is not an image or video`);
  if (source.type.startsWith("video/") && source.size > MAX_VIDEO_BYTES) throw new Error(`${source.name} is larger than 50 MB`);
  const file = source.type.startsWith("image/") ? await compressImage(source) : source;
  const signRes = await fetch("/api/admin/venues/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "sign", venueId, fileName: file.name, contentType: file.type, fileSize: file.size }),
  });
  const signed = await signRes.json();
  if (!signRes.ok) throw new Error(signed.error || "Could not start upload");
  const supabase = createClient();
  const { error: uploadError } = await supabase.storage.from("venue-media").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
  if (uploadError) throw uploadError;
  const completeRes = await fetch("/api/admin/venues/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "complete", venueId, path: signed.path, mediaType: signed.mediaType }),
  });
  const completed = await completeRes.json();
  if (!completeRes.ok) throw new Error(completed.error || "Could not save upload");
}

export default function VenueEditor() {
  const [q, setQ] = useState("");
  const [venues, setVenues] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [newVenue, setNewVenue] = useState(EMPTY_VENUE);
  const [newTagIds, setNewTagIds] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [createStatus, setCreateStatus] = useState("");

  const search = useCallback(async (query) => {
    const res = await fetch(`/api/admin/venues?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    if (!res.ok) { setErr(d.error); setBusy(false); return; }
    setVenues(d.venues || []);
  }, []);

  useEffect(() => {
    search("");
    fetch("/api/admin/tags").then((res) => res.json()).then((data) => {
      setCategories(data.categories || []);
      setTags((data.tags || []).filter((tag) => tag.is_active));
    });
  }, [search]);

  async function patch(id, fields, tagIds) {
    setBusy(true);
    const res = await fetch("/api/admin/venues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: fields, ...(tagIds ? { tag_ids: tagIds } : {}) }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error);
    else setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, ...fields, ...(tagIds ? { tag_ids: tagIds } : {}) } : v)));
    setBusy(false);
  }

  async function createVenue() {
    if (!newVenue.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newVenue, tag_ids: newTagIds }),
    });
    const d = await res.json();
    if (!res.ok) { setErr(d.error); return; }
    try {
      for (let index = 0; index < newFiles.length; index += 1) {
        setCreateStatus(`Uploading ${index + 1} of ${newFiles.length}…`);
        await uploadVenueFile(d.id, newFiles[index]);
      }
    } catch (error) {
      setErr(`Venue created, but media upload failed: ${error.message}`);
    }
    setBusy(false);
    setNewVenue(EMPTY_VENUE);
    setNewTagIds([]);
    setNewFiles([]);
    setCreateStatus("");
    setCreating(false);
    await search(q);
    setOpenId(d.id);
  }

  async function suggestVenue() {
    if (!newVenue.placeId.trim()) return;
    setSuggesting(true);
    setErr(null);
    const res = await fetch("/api/admin/venues/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: newVenue.placeId }),
    });
    const data = await res.json();
    if (!res.ok) setErr(data.error);
    else {
      setNewVenue((current) => ({ ...current, ...data.place }));
      setNewTagIds(data.tag_ids || []);
    }
    setSuggesting(false);
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
          <div className="venue-create-form">
            <div className="venue-create-heading">
              <div><strong>New venue</strong><p>Paste a Google Place ID to fill details and suggest tags, then review everything before creating.</p></div>
              <button className="btn small ghost" type="button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
            <div className="field">
              <label htmlFor="new-place-id">Google Place ID</label>
              <div className="venue-ai-row">
                <input id="new-place-id" type="text" value={newVenue.placeId} onChange={(e) => setNewVenue({ ...newVenue, placeId: e.target.value })} placeholder="ChIJ…" />
                <button className="btn small primary" type="button" disabled={suggesting || !newVenue.placeId.trim()} onClick={suggestVenue}>
                  {suggesting ? "Suggesting…" : "✨ Fill + suggest tags"}
                </button>
              </div>
              <span className="hint">AI suggestions are a draft—you can change every field and tag.</span>
            </div>
            <div className="venue-form-grid">
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
            </div>
            <div className="field">
              <label>Description</label>
              <textarea value={newVenue.description} onChange={(e) => setNewVenue({ ...newVenue, description: e.target.value })} />
            </div>
            <div className="field">
              <label>Google Maps URL</label>
              <input type="url" value={newVenue.google_maps_url} onChange={(e) => setNewVenue({ ...newVenue, google_maps_url: e.target.value })} />
            </div>
            <div className="field">
              <label>Optional external video URL</label>
              <input type="url" value={newVenue.hero_video_url} onChange={(e) => setNewVenue({ ...newVenue, hero_video_url: e.target.value })} />
            </div>
            <div className="venue-form-grid">
              <div className="field">
                <label>Age access</label>
                <select value={newVenue.age_restriction} onChange={(e) => setNewVenue({ ...newVenue, age_restriction: e.target.value })}>
                  <option value="all-ages">All ages</option>
                  <option value="18-plus">18+</option>
                  <option value="21-plus">21+</option>
                </select>
              </div>
              <div className="venue-create-options">
                <label className="toggle-row"><input type="checkbox" checked={newVenue.is_aesthetic} onChange={(e) => setNewVenue({ ...newVenue, is_aesthetic: e.target.checked })} /> Aesthetic spot</label>
                <label className="toggle-row"><input type="checkbox" checked={newVenue.is_trending} onChange={(e) => setNewVenue({ ...newVenue, is_trending: e.target.checked })} /> Add to Our picks</label>
              </div>
            </div>
            <div className="field">
              <label>Tags</label>
              <TagPicker categories={categories} tags={tags} selected={newTagIds} onChange={setNewTagIds} />
            </div>
            <div className="field">
              <label>Photos & videos</label>
              <p className="venue-media-help">Select several files. Every photo is resized, converted to WebP, and compressed below 1.5 MB automatically. Videos upload directly.</p>
              <input type="file" accept="image/*,video/*" multiple onChange={(e) => setNewFiles([...(e.target.files || [])])} />
              {newFiles.length > 0 && <div className="media-upload-status">{newFiles.length} file{newFiles.length === 1 ? "" : "s"} ready</div>}
            </div>
            {createStatus && <div className="media-upload-status" role="status">{createStatus}</div>}
            <button className="btn primary block" disabled={busy || !newVenue.name.trim()} onClick={createVenue}>
              {busy ? "Creating venue…" : "Create venue with everything"}
            </button>
          </div>
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
          {openId === v.id && (
            <VenueEditFields
              venue={v}
              categories={categories}
              tags={tags}
              onSave={(fields, tagIds) => patch(v.id, fields, tagIds)}
              busy={busy}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function TagPicker({ categories, tags, selected, onChange }) {
  return (
    <div className="venue-tag-picker">
      {categories.map((category) => {
        const categoryTags = tags.filter((tag) => tag.category_id === category.id);
        if (!categoryTags.length) return null;
        return (
          <fieldset className="venue-tag-group" key={category.id}>
            <legend>{category.name}</legend>
            <div className="chips">
              {categoryTags.map((tag) => {
                const active = selected.includes(tag.id);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    className={`chip ${active ? "sel" : ""}`}
                    aria-pressed={active}
                    onClick={() => onChange(active ? selected.filter((id) => id !== tag.id) : [...selected, tag.id])}
                  >
                    {tag.display_name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function VenueEditFields({ venue, categories, tags, onSave, busy }) {
  const [name, setName] = useState(venue.name || "");
  const [neighborhood, setNeighborhood] = useState(venue.neighborhood || "");
  const [city, setCity] = useState(venue.city || "Abu Dhabi");
  const [avgSpend, setAvgSpend] = useState(venue.avg_spend_aed ?? 0);
  const [description, setDescription] = useState(venue.description || "");
  const [heroVideo, setHeroVideo] = useState(venue.hero_video_url || "");
  const [ageRestriction, setAgeRestriction] = useState(venue.age_restriction || "all-ages");
  const [isAesthetic, setIsAesthetic] = useState(!!venue.is_aesthetic);
  const [media, setMedia] = useState([]);
  const [tagIds, setTagIds] = useState(venue.tag_ids || []);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [mediaError, setMediaError] = useState(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [mediaBusy, setMediaBusy] = useState(false);

  const loadMedia = useCallback(async () => {
    const res = await fetch(`/api/admin/venues/media?venueId=${venue.id}`);
    const d = await res.json();
    if (res.ok) setMedia(d.media || []);
  }, [venue.id]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  async function uploadFile(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploading(true);
    setMediaError(null);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const source = files[index];
        setUploadStatus(`Optimizing ${index + 1} of ${files.length}…`);
        setUploadStatus(`Uploading ${index + 1} of ${files.length}…`);
        await uploadVenueFile(venue.id, source);
      }
      await loadMedia();
      setUploadStatus("Upload complete");
      e.target.value = "";
    } catch (error) {
      setMediaError(error.message || "Upload failed");
      setUploadStatus("");
    } finally {
      setUploading(false);
    }
  }

  async function addMediaLink() {
    const url = safeUrl(mediaUrl.trim());
    if (!url) {
      setMediaError("Enter a valid http(s) image or video URL.");
      return;
    }
    setMediaBusy(true);
    setMediaError(null);
    const res = await fetch("/api/admin/venues/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "link", venueId: venue.id, url, mediaType }),
    });
    const data = await res.json();
    if (!res.ok) setMediaError(data.error || "Could not add media link");
    else {
      setMediaUrl("");
      await loadMedia();
    }
    setMediaBusy(false);
  }

  async function moveMedia(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= media.length || mediaBusy) return;
    const previous = media;
    const reordered = [...media];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(destination, 0, moved);
    setMedia(reordered);
    setMediaBusy(true);
    setMediaError(null);
    const res = await fetch("/api/admin/venues/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: venue.id, orderedIds: reordered.map((item) => item.id) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMedia(previous);
      setMediaError(data.error || "Could not reorder media");
      await loadMedia();
    }
    setMediaBusy(false);
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
        <label>Venue tags</label>
        <div className="venue-tag-picker">
          {categories.map((category) => {
            const categoryTags = tags.filter((tag) => tag.category_id === category.id);
            if (!categoryTags.length) return null;
            return (
              <fieldset className="venue-tag-group" key={category.id}>
                <legend>{category.name}</legend>
                <div className="chips">
                  {categoryTags.map((tag) => {
                    const selected = tagIds.includes(tag.id);
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        className={`chip ${selected ? "sel" : ""}`}
                        aria-pressed={selected}
                        onClick={() => setTagIds((current) => selected ? current.filter((id) => id !== tag.id) : [...current, tag.id])}
                      >
                        {tag.display_name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>
      <div className="field">
        <label>Hero video URL</label>
        <input type="url" value={heroVideo} onChange={(e) => setHeroVideo(e.target.value)} />
      </div>
      <div className="venue-form-grid">
        <div className="field">
          <label>Age access</label>
          <select value={ageRestriction} onChange={(e) => setAgeRestriction(e.target.value)}>
            <option value="all-ages">All ages</option>
            <option value="18-plus">18+</option>
            <option value="21-plus">21+</option>
          </select>
        </div>
        <label className="toggle-row"><input type="checkbox" checked={isAesthetic} onChange={(e) => setIsAesthetic(e.target.checked)} /> Aesthetic spot</label>
      </div>

      <div className="field">
        <label>Photos & videos</label>
        <p className="venue-media-help">Upload files or add direct image/video links. Use the arrow controls to choose the order shown on venue cards; the first item is the cover.</p>
        <div className="media-grid admin-media-grid">
          {media.map((m, index) => (
            <div className="media-thumb admin-media-thumb" key={m.id}>
              {m.media_type === "video" ? (
                <video src={safeUrl(m.url)} muted preload="metadata" controls />
              ) : (
                <img src={safeUrl(m.url)} alt={`${venue.name} media ${index + 1}`} />
              )}
              {index === 0 && <span className="media-cover-label">Cover</span>}
              <button type="button" className="media-remove" aria-label={`Remove media ${index + 1}`} onClick={() => removeMedia(m.id)} disabled={mediaBusy}>✕</button>
              <div className="media-order-controls">
                <button type="button" aria-label={`Move media ${index + 1} earlier`} onClick={() => moveMedia(index, -1)} disabled={index === 0 || mediaBusy}>←</button>
                <span>{index + 1}</span>
                <button type="button" aria-label={`Move media ${index + 1} later`} onClick={() => moveMedia(index, 1)} disabled={index === media.length - 1 || mediaBusy}>→</button>
              </div>
            </div>
          ))}
        </div>
        <div className="media-link-row">
          <select aria-label="Media link type" value={mediaType} onChange={(e) => setMediaType(e.target.value)} disabled={mediaBusy}>
            <option value="image">Image link</option>
            <option value="video">Video link</option>
          </select>
          <input type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…" aria-label="Image or video URL" />
          <button type="button" className="btn small" onClick={addMediaLink} disabled={mediaBusy || !mediaUrl.trim()}>Add link</button>
        </div>
        <div className="media-upload-divider"><span>or upload files</span></div>
        <input type="file" accept="image/*,video/*" multiple onChange={uploadFile} disabled={uploading || mediaBusy} />
        {uploadStatus && <div className="media-upload-status" role="status">{uploadStatus}</div>}
        {mediaError && <div className="notice err" role="alert">{mediaError}</div>}
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
            age_restriction: ageRestriction,
            is_aesthetic: isAesthetic,
          }, tagIds)
        }
      >
        Save changes
      </button>
    </div>
  );
}

