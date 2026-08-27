"use client";

import { useEffect, useState } from "react";
import { Archive, Pencil, Plus, RotateCcw, Tag, Trash2 } from "lucide-react";
import styles from "./AccountPages.module.css";

const AUDIENCES = [
  ["private", "Only me", "Private until you change it"],
  ["friends", "Friends", "All accepted Weyn friends"],
  ["public", "Public", "Anyone can find and add it"],
];

export default function UserTagsManager({ venues }) {
  const [tags, setTags] = useState([]);
  const [archived, setArchived] = useState([]);
  const [bookmarked, setBookmarked] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/user-tags");
    const body = await response.json();
    if (!response.ok) {
      setNotice(body.error || "Couldn’t load your tags.");
      return;
    }
    setTags(body.tags || []);
    setArchived(body.archived || []);
    setBookmarked(body.bookmarked || []);
  }

  useEffect(() => { load(); }, []);

  function start(tag = null) {
    setNotice("");
    setEditing({
      id: tag?.id || null,
      name: tag?.name || "",
      description: tag?.description || "",
      visibility: tag?.visibility || "",
      venueIds: new Set((tag?.user_tag_venues || []).map((item) => item.venue_id)),
    });
  }

  async function save() {
    if (!editing.name.trim() || !editing.visibility) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/user-tags", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: editing.id,
        action: "update",
        name: editing.name,
        description: editing.description,
        visibility: editing.visibility,
        venueIds: [...editing.venueIds],
      }),
    });
    const body = await response.json();
    if (response.ok) {
      setEditing(null);
      setNotice(editing.id ? "Tag updated." : "Tag created.");
      await load();
    } else setNotice(body.error || "Couldn’t save that tag.");
    setBusy(false);
  }

  async function lifecycle(id, action) {
    if (action === "delete" && !confirm("Delete this tag permanently?")) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/user-tags", {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "delete" ? { id } : { id, action }),
    });
    const body = await response.json();
    if (response.ok) {
      setNotice(action === "archive" ? "Tag archived." : action === "restore" ? "Tag restored." : "Tag deleted.");
      await load();
    } else setNotice(body.error || "Couldn’t update that tag.");
    setBusy(false);
  }

  return (
    <section className="saved-collections" aria-labelledby="personal-tags-title">
      <div className={styles.savedHead}>
        <div><span className="eyebrow">Your labels</span><h2 id="personal-tags-title">Personal tags</h2></div>
        <button className="btn small ghost" type="button" onClick={() => start()}><Plus aria-hidden="true" /> New tag</button>
      </div>
      <p className="sub">Group places your way. You decide whether every tag is private, shared with friends, or public and searchable.</p>

      {notice && <div className="notice" role="status">{notice}</div>}

      {editing && (
        <div className={`card ${styles.savedEditor}`}>
          <div className={styles.savedHead}>
            <div><span className="eyebrow">Personal tag</span><h2>{editing.id ? "Edit tag" : "Create a tag"}</h2></div>
            <button className="btn small ghost" type="button" onClick={() => setEditing(null)}>Close</button>
          </div>
          <div className="field"><label htmlFor="user-tag-name">Tag name</label><input id="user-tag-name" maxLength={40} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="Quiet work spots" /></div>
          <div className="field"><label htmlFor="user-tag-description">Description</label><input id="user-tag-description" maxLength={240} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Optional note about what belongs here" /></div>
          <fieldset className={styles.audienceGroup}>
            <legend>Who can see this tag?</legend>
            <div className={styles.audienceOptions}>
              {AUDIENCES.map(([value, label, help]) => (
                <label className={styles.audienceOption} key={value}>
                  <input type="radio" name="user-tag-audience" value={value} checked={editing.visibility === value} onChange={() => setEditing({ ...editing, visibility: value })} />
                  <strong>{label}</strong><small>{help}</small>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <strong>Places with this tag</strong>
            <div className={styles.pickGrid}>
              {venues.map((venue) => (
                <label className={editing.venueIds.has(venue.id) ? "saved-pick selected" : "saved-pick"} key={venue.id}>
                  <input type="checkbox" checked={editing.venueIds.has(venue.id)} onChange={() => {
                    const next = new Set(editing.venueIds);
                    next.has(venue.id) ? next.delete(venue.id) : next.add(venue.id);
                    setEditing({ ...editing, venueIds: next });
                  }} />
                  <span><strong>{venue.name}</strong><small>{venue.neighborhood || venue.city || "UAE"}</small></span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn primary block" type="button" disabled={busy || !editing.name.trim() || !editing.visibility} onClick={save}>{busy ? "Saving…" : editing.id ? "Save changes" : "Create tag"}</button>
        </div>
      )}

      {!tags.length && !editing && <div className="saved-empty"><Tag /><strong>No personal tags yet</strong><span>Create one to organise places beyond fixed vibe labels.</span></div>}
      {!!tags.length && <div className={styles.listGrid}>{tags.map((tag) => <article className={`saved-list-card ${styles.listCard}`} key={tag.id}>
        <div><span className={`saved-visibility ${tag.visibility}`}>{tag.visibility}</span><h3>#{tag.name}</h3>{tag.description && <p>{tag.description}</p>}</div>
        <span className="saved-list-meta">{tag.user_tag_venues?.length || 0} place{tag.user_tag_venues?.length === 1 ? "" : "s"}</span>
        <div className="saved-list-actions"><button type="button" onClick={() => start(tag)}><Pencil aria-hidden="true" />Edit</button><button type="button" disabled={busy} onClick={() => lifecycle(tag.id, "archive")}><Archive aria-hidden="true" />Archive</button><button className="is-danger" type="button" disabled={busy} onClick={() => lifecycle(tag.id, "delete")}><Trash2 aria-hidden="true" />Delete</button></div>
      </article>)}</div>}

      {!!archived.length && <details className="saved-collections">
        <summary className={styles.savedHead}><strong>Archived tags</strong><span className="saved-count">{archived.length}</span></summary>
        <div className={styles.listGrid}>{archived.map((tag) => <article className={`saved-list-card ${styles.listCard}`} key={tag.id}>
          <div><span className="saved-visibility private">archived</span><h3>#{tag.name}</h3></div>
          <div className="saved-list-actions"><button type="button" disabled={busy} onClick={() => lifecycle(tag.id, "restore")}><RotateCcw aria-hidden="true" />Restore</button><button className="is-danger" type="button" disabled={busy} onClick={() => lifecycle(tag.id, "delete")}><Trash2 aria-hidden="true" />Delete</button></div>
        </article>)}</div>
      </details>}

      {!!bookmarked.length && <div>
        <div className={styles.savedHead}><div><span className="eyebrow">From Discover</span><h2>Tags you added</h2></div><span className="saved-count">{bookmarked.length}</span></div>
        <div className={styles.listGrid}>{bookmarked.map((tag) => <article className={`saved-list-card ${styles.listCard}`} key={tag.id}>
          <div><span className={`saved-visibility ${tag.visibility}`}>{tag.visibility}</span><h3>#{tag.name}</h3>{tag.description && <p>{tag.description}</p>}</div>
          <span className="saved-list-meta">{tag.user_tag_venues?.length || 0} places</span>
        </article>)}</div>
      </div>}
    </section>
  );
}
