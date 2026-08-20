"use client";
import { useState, useEffect, useCallback } from "react";
import { safeUrl } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/client";

const MAX_IMAGE_EDGE = 1600;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not compress image")), "image/webp", 0.78)
  );
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
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
  const [newVenue, setNewVenue] = useState({ name: "", neighborhood: "", city: "Abu Dhabi", avg_spend_aed: 0 });

  const search = useCallback(async (query) => {
    const res = await fetch(`/api/admin/venues?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    if (!res.ok) { setErr(d.error); return; }
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

function VenueEditFields({ venue, categories, tags, onSave, busy }) {
  const [name, setName] = useState(venue.name || "");
  const [neighborhood, setNeighborhood] = useState(venue.neighborhood || "");
  const [city, setCity] = useState(venue.city || "Abu Dhabi");
  const [avgSpend, setAvgSpend] = useState(venue.avg_spend_aed ?? 0);
  const [description, setDescription] = useState(venue.description || "");
  const [heroVideo, setHeroVideo] = useState(venue.hero_video_url || "");
  const [media, setMedia] = useState([]);
  const [tagIds, setTagIds] = useState(venue.tag_ids || []);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [mediaError, setMediaError] = useState(null);

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
        if (!source.type.startsWith("image/") && !source.type.startsWith("video/")) throw new Error(`${source.name} is not an image or video`);
        if (source.type.startsWith("video/") && source.size > MAX_VIDEO_BYTES) throw new Error(`${source.name} is larger than 100 MB`);
        const file = source.type.startsWith("image/") ? await compressImage(source) : source;

        const signRes = await fetch("/api/admin/venues/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: "sign", venueId: venue.id, fileName: file.name, contentType: file.type }),
        });
        const signed = await signRes.json();
        if (!signRes.ok) throw new Error(signed.error || "Could not start upload");

        setUploadStatus(`Uploading ${index + 1} of ${files.length}…`);
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("venue-media")
          .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const completeRes = await fetch("/api/admin/venues/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intent: "complete",
            venueId: venue.id,
            path: signed.path,
            publicUrl: signed.publicUrl,
            mediaType: signed.mediaType,
          }),
        });
        const completed = await completeRes.json();
        if (!completeRes.ok) throw new Error(completed.error || "Could not save upload");
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

      <div className="field">
        <label>Photos & videos</label>
        <p className="venue-media-help">Select several files at once. Photos are resized to 1600px and compressed to WebP before upload. Videos can be up to 100 MB.</p>
        <div className="media-grid">
          {media.map((m) => (
            <div className="media-thumb" key={m.id}>
              {m.media_type === "video" ? (
                <video src={safeUrl(m.url)} muted preload="metadata" controls />
              ) : (
                <img src={safeUrl(m.url)} alt="" />
              )}
              <button type="button" className="media-remove" aria-label="Remove media" onClick={() => removeMedia(m.id)}>✕</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*,video/*" multiple onChange={uploadFile} disabled={uploading} />
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
          }, tagIds)
        }
      >
        Save changes
      </button>
    </div>
  );
}

