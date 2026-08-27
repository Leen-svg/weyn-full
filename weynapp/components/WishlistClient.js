"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import VenueCard from "./VenueCard";
import VenueActions from "./VenueActions";
import { Archive, FolderPlus, List, Map, Pencil, RotateCcw, Share2, Trash2 } from "lucide-react";
import styles from "./AccountPages.module.css";

const WishlistMap = dynamic(() => import("./WishlistMap"), {
  ssr: false,
  loading: () => <div className="home-skeleton__card" aria-label="Loading saved places map" />,
});

function validCoordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

export default function WishlistClient({ initialVenues }) {
  const [venues, setVenues] = useState(initialVenues);
  const [view, setView] = useState("list");
  const [lists, setLists] = useState([]);
  const [archived, setArchived] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [bookmarked, setBookmarked] = useState([]);
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [editing, setEditing] = useState(null);
  const [sharing, setSharing] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const mappedCount = useMemo(
    () => venues.filter((venue) => validCoordinate(venue.latitude, -90, 90) && validCoordinate(venue.longitude, -180, 180)).length,
    [venues],
  );

  async function loadCollections() {
    const [listResponse, groupResponse, friendResponse] = await Promise.all([
      fetch("/api/saved-lists"), fetch("/api/groups"), fetch("/api/friends"),
    ]);
    const [listBody, groupBody, friendBody] = await Promise.all([listResponse.json(), groupResponse.json(), friendResponse.json()]);
    setLists(listBody.lists || []);
    setArchived(listBody.archived || []);
    setSharedWithMe(listBody.sharedWithMe || []);
    setBookmarked(listBody.bookmarked || []);
    setGroups(groupBody.groups || []);
    setFriends((friendBody.friends || []).map((friend) => friend.other));
  }

  useEffect(() => { loadCollections(); }, []);

  function startList(list = null) {
    setNotice("");
    setEditing({
      id: list?.id || null,
      title: list?.title || "",
      description: list?.description || "",
      tags: (list?.tags || []).join(", "),
      visibility: list?.visibility || "",
      venueIds: new Set((list?.saved_list_items || []).map((item) => item.venue_id)),
    });
  }

  async function saveList() {
    if (!editing.visibility) {
      setNotice("Choose who can see this list before saving.");
      return;
    }
    setBusy(true); setNotice("");
    const payload = { id: editing.id, action: "update", title: editing.title, description: editing.description, tags: editing.tags.split(","), visibility: editing.visibility, venueIds: [...editing.venueIds] };
    const response = await fetch("/api/saved-lists", { method: editing.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (response.ok) { setEditing(null); setNotice(editing.id ? "List updated." : "List created."); await loadCollections(); }
    else setNotice(body.error || "Couldn't save that list.");
    setBusy(false);
  }

  async function removeList(id) {
    if (!confirm("Delete this list? Your saved places will stay saved.")) return;
    await fetch("/api/saved-lists", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    loadCollections();
  }

  async function changeListState(id, action) {
    setBusy(true); setNotice("");
    const response = await fetch("/api/saved-lists", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) });
    const body = await response.json();
    if (response.ok) {
      setNotice(action === "archive" ? "List archived. You can restore it below." : "List restored.");
      await loadCollections();
    } else setNotice(body.error || "Couldn’t update that list.");
    setBusy(false);
  }

  async function shareList(action, targetId, visibility) {
    setBusy(true); setNotice("");
    const response = await fetch("/api/saved-lists", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: sharing.id, action, targetId, visibility }) });
    const body = await response.json();
    if (response.ok) { setSharing(null); setNotice(action === "share-post" ? "Your list is now a post." : "List shared."); await loadCollections(); }
    else setNotice(body.error || "Couldn't share that list.");
    setBusy(false);
  }

  return (
    <div className={styles.savedHub}>
      <div className={styles.savedActions}>
        <button className="btn primary" type="button" onClick={() => startList()}><FolderPlus /> New list</button>
        <a className="btn ghost" href="/plan">Plan a day</a>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}

      {editing && <section className={`card ${styles.savedEditor}`}>
        <div className={styles.savedHead}><div><span className="eyebrow">Custom collection</span><h2>{editing.id ? "Edit list" : "Create a list"}</h2></div><button className="btn small ghost" type="button" onClick={() => setEditing(null)}>Close</button></div>
        <div className="field"><label htmlFor="saved-list-title">List name</label><input id="saved-list-title" maxLength={80} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} placeholder="Late-night Dubai" /></div>
        <div className="field"><label htmlFor="saved-list-description">Description</label><input id="saved-list-description" maxLength={240} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Optional note for the people you share with" /></div>
        <fieldset className={styles.audienceGroup}>
          <legend>Who can see this list?</legend>
          <div className={styles.audienceOptions}>
            {[
              ["private", "Only me", "Private until you change it"],
              ["friends", "Friends", "All accepted Weyn friends"],
              ["public", "Public", "Anyone can open and discover it"],
            ].map(([value, label, help]) => (
              <label className={styles.audienceOption} key={value}>
                <input type="radio" name="saved-list-audience" value={value} checked={editing.visibility === value} onChange={() => setEditing({ ...editing, visibility: value })} />
                <strong>{label}</strong>
                <small>{help}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field"><label htmlFor="saved-list-tags">Your tags</label><input id="saved-list-tags" value={editing.tags} onChange={(event) => setEditing({ ...editing, tags: event.target.value })} placeholder="date night, rooftop, quiet" /><small>Separate tags with commas. These are yours, not Weyn&apos;s fixed vibe tags.</small></div>
        <div className={styles.pickGrid}>
          {venues.map((venue) => <label className={editing.venueIds.has(venue.id) ? "saved-pick selected" : "saved-pick"} key={venue.id}><input type="checkbox" checked={editing.venueIds.has(venue.id)} onChange={() => { const next = new Set(editing.venueIds); next.has(venue.id) ? next.delete(venue.id) : next.add(venue.id); setEditing({ ...editing, venueIds: next }); }} /><span><strong>{venue.name}</strong><small>{venue.neighborhood || venue.city || "UAE"}</small></span></label>)}
        </div>
        <button className="btn primary block" disabled={busy || !editing.title.trim() || !editing.visibility} onClick={saveList}>{busy ? "Saving…" : editing.id ? "Save changes" : "Create list"}</button>
      </section>}

      <section className="saved-collections">
        <div className={styles.savedHead}><div><span className="eyebrow">Your lists</span><h2>Collections</h2></div><span className="saved-count">{lists.length}</span></div>
        {!lists.length && <div className="saved-empty"><FolderPlus /><strong>No custom lists yet</strong><span>Create one from the places you have saved.</span></div>}
        <div className={styles.listGrid}>{lists.map((list) => <article className={`saved-list-card ${styles.listCard}`} key={list.id}>
          <div><span className={`saved-visibility ${list.visibility}`}>{list.visibility}</span><h3>{list.title}</h3>{list.description && <p>{list.description}</p>}</div>
          <div className="tag-row">{(list.tags || []).map((tag) => <span className="tag-pill" key={tag}>#{tag}</span>)}</div>
          <span className="saved-list-meta">{list.saved_list_items?.length || 0} place{list.saved_list_items?.length === 1 ? "" : "s"}</span>
          <div className="saved-list-actions"><button type="button" onClick={() => startList(list)}><Pencil aria-hidden="true" />Edit</button><button type="button" onClick={() => setSharing(list)}><Share2 aria-hidden="true" />Share</button><a href={`/lists/${list.share_slug}`}>Open</a><button type="button" disabled={busy} onClick={() => changeListState(list.id, "archive")}><Archive aria-hidden="true" />Archive</button><button className="is-danger" type="button" onClick={() => removeList(list.id)}><Trash2 aria-hidden="true" />Delete</button></div>
        </article>)}</div>
      </section>

      {!!archived.length && <details className="saved-collections">
        <summary className={styles.savedHead}><div><span className="eyebrow">Out of the way</span><h2>Archived lists</h2></div><span className="saved-count">{archived.length}</span></summary>
        <div className={styles.listGrid}>{archived.map((list) => <article className={`saved-list-card ${styles.listCard}`} key={list.id}>
          <div><span className="saved-visibility private">archived</span><h3>{list.title}</h3>{list.description && <p>{list.description}</p>}</div>
          <span className="saved-list-meta">{list.saved_list_items?.length || 0} place{list.saved_list_items?.length === 1 ? "" : "s"}</span>
          <div className="saved-list-actions"><button type="button" disabled={busy} onClick={() => changeListState(list.id, "restore")}><RotateCcw aria-hidden="true" />Restore</button><button className="is-danger" type="button" onClick={() => removeList(list.id)}><Trash2 aria-hidden="true" />Delete</button></div>
        </article>)}</div>
      </details>}

      {!!sharedWithMe.length && <section className="saved-collections">
        <div className={styles.savedHead}><div><span className="eyebrow">From your people</span><h2>Shared with you</h2></div><span className="saved-count">{sharedWithMe.length}</span></div>
        <div className={styles.listGrid}>{sharedWithMe.map((list) => <a className={`saved-list-card saved-list-link ${styles.listCard}`} href={`/lists/${list.share_slug}`} key={list.id}><div><span className="saved-visibility friends">shared</span><h3>{list.title}</h3>{list.description && <p>{list.description}</p>}</div><div className="tag-row">{(list.tags || []).map((tag) => <span className="tag-pill" key={tag}>#{tag}</span>)}</div><span className="saved-list-meta">{list.saved_list_items?.length || 0} places · open list →</span></a>)}</div>
      </section>}

      {!!bookmarked.length && <section className="saved-collections">
        <div className={styles.savedHead}><div><span className="eyebrow">From Discover</span><h2>Lists you added</h2></div><span className="saved-count">{bookmarked.length}</span></div>
        <div className={styles.listGrid}>{bookmarked.map((list) => <a className={`saved-list-card saved-list-link ${styles.listCard}`} href={`/lists/${list.share_slug}`} key={list.id}><div><span className={`saved-visibility ${list.visibility}`}>{list.visibility}</span><h3>{list.title}</h3>{list.description && <p>{list.description}</p>}</div><div className="tag-row">{(list.tags || []).map((tag) => <span className="tag-pill" key={tag}>#{tag}</span>)}</div><span className="saved-list-meta">{list.saved_list_items?.length || 0} places · open list →</span></a>)}</div>
      </section>}

      {sharing && <div className="saved-share-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-list-title"><div className={`saved-share-sheet ${styles.shareSheet}`}>
        <div className={styles.savedHead}><div><span className="eyebrow">Choose the audience</span><h2 id="share-list-title">Share “{sharing.title}”</h2></div><button className="btn small ghost" onClick={() => setSharing(null)}>Close</button></div>
        <div className="saved-share-section"><strong>Groups</strong>{groups.map((group) => <button key={group.id} disabled={busy} onClick={() => shareList("share-group", group.id)}><span>{group.name}</span><small>Post into group chat</small></button>)}{!groups.length && <small>No groups yet.</small>}</div>
        <div className="saved-share-section"><strong>Friends</strong>{friends.map((friend) => <button key={friend.id} disabled={busy} onClick={() => shareList("share-friend", friend.id)}><span>{friend.display_name || "Friend"}</span><small>Share directly</small></button>)}{!friends.length && <small>No friends yet.</small>}</div>
        <div className="saved-share-section"><strong>Post</strong><button disabled={busy} onClick={() => shareList("share-post", null, "friends")}><span>Friends post</span><small>Only accepted friends can see it</small></button><button disabled={busy} onClick={() => shareList("share-post", null, "public")}><span>Public post</span><small>Visible in the public Weyn feed</small></button></div>
      </div></div>}

      {!venues.length ? <div className="saved-empty"><List /><strong>Nothing saved yet</strong><span>Places you save from Discover or Find will appear here.</span></div> : <>
      <div className="chips" role="group" aria-label="Saved places view" style={{ marginBottom: 18 }}>
        <button type="button" className={`chip ${view === "list" ? "sel" : ""}`} aria-pressed={view === "list"} onClick={() => setView("list")}><List /> All saved · {venues.length}</button>
        <button type="button" className={`chip ${view === "map" ? "sel" : ""}`} aria-pressed={view === "map"} onClick={() => setView("map")}><Map /> Map · {mappedCount}</button>
      </div>

      {view === "map" ? (
        <WishlistMap venues={venues} />
      ) : (
        <div className="venue-list-single">
          {venues.map((v) => (
            <VenueCard key={v.id} venue={v}>
              <VenueActions venue={v} initialSaved onRemoved={(id) => setVenues((prev) => prev.filter((x) => x.id !== id))} />
            </VenueCard>
          ))}
        </div>
      )}</>}
    </div>
  );
}
