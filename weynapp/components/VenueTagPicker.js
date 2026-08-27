"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tag as TagIcon } from "lucide-react";

// Tagging a place you have already saved. Before this, membership could only
// be changed from the Personal tags section by editing a tag and ticking
// venues — there was no way to go the other direction, from a place to a tag.
export default function VenueTagPicker({ venue, onChanged }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const boxRef = useRef(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/user-tags", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't load your tags.");
      setTags(body.tags || []);
    } catch (cause) {
      setError(cause.message);
      setTags([]);
    }
  }, []);

  useEffect(() => {
    if (open && tags === null) load();
  }, [open, tags, load]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === "Escape") setOpen(false); }
    function onClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  const has = (tag) => (tag.user_tag_venues || []).some((row) => row.venue_id === venue.id);

  async function toggle(tag) {
    if (busyId) return;
    setBusyId(tag.id);
    setError(null);
    const action = has(tag) ? "detach" : "attach";
    try {
      const res = await fetch("/api/user-tags", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: tag.id, action, venueId: venue.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't update that tag.");
      setTags((prev) => prev.map((t) => t.id !== tag.id ? t : {
        ...t,
        user_tag_venues: action === "attach"
          ? [...(t.user_tag_venues || []), { venue_id: venue.id }]
          : (t.user_tag_venues || []).filter((row) => row.venue_id !== venue.id),
      }));
      window.dispatchEvent(new CustomEvent("weyn:tags-changed"));
      onChanged?.();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusyId(null);
    }
  }

  async function createTag(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      // New tags made this way start private; the tag editor can widen it.
      const res = await fetch("/api/user-tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, visibility: "private", venueIds: [venue.id] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't create that tag.");
      setNewName("");
      await load();
      window.dispatchEvent(new CustomEvent("weyn:tags-changed"));
      onChanged?.();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setCreating(false);
    }
  }

  const mine = (tags || []).filter((t) => has(t));

  return (
    <div className="venue-tag-picker" ref={boxRef}>
      <button className="btn small ghost" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <TagIcon aria-hidden="true" size={14} />
        {mine.length ? `Tags · ${mine.length}` : "Add tag"}
      </button>

      {open && (
        <div className="venue-tag-picker__menu" role="dialog" aria-label={`Tag ${venue.name}`}>
          {tags === null && <p className="venue-tag-picker__note">Loading your tags…</p>}
          {tags?.length === 0 && <p className="venue-tag-picker__note">No tags yet. Make your first below.</p>}

          {tags?.length > 0 && (
            <ul className="venue-tag-picker__list">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={has(tag)}
                      disabled={busyId === tag.id}
                      onChange={() => toggle(tag)}
                    />
                    <span>{tag.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <form className="venue-tag-picker__new" onSubmit={createTag}>
            <label className="sr-only" htmlFor={`new-tag-${venue.id}`}>New tag name</label>
            <input
              id={`new-tag-${venue.id}`}
              value={newName}
              maxLength={40}
              placeholder="New tag…"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button className="btn small" type="submit" disabled={creating || !newName.trim()}>
              {creating ? "…" : "Add"}
            </button>
          </form>

          {error && <p className="venue-tag-picker__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
