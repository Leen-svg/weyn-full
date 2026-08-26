"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapChooser from "./MapChooser";
import styles from "./AccountPages.module.css";

export default function BoardEditor({ boardId }) {
  const router = useRouter();
  const inviteInputRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [audienceChoice, setAudienceChoice] = useState("private");

  async function load() {
    const response = await fetch(`/api/boards/${boardId}`);
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Couldn’t load this board.");
      return;
    }
    setData(body);
    setTitle(body.board.title);
    setAudienceChoice(body.board.visibility || (body.board.is_public ? "public" : "private"));
  }

  useEffect(() => { load(); }, [boardId]);

  async function act(action, extra = {}, { reload = true } = {}) {
    setError("");
    setNotice("");
    setBusy(true);
    const response = await fetch(`/api/boards/${boardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "That change didn’t save.");
      setBusy(false);
      return false;
    }
    if (reload) await load();
    setBusy(false);
    return true;
  }

  async function move(index, offset) {
    const rows = [...data.places];
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    setData({ ...data, places: rows });
    await act("reorder", { placeIds: rows.map((place) => place.id) });
  }

  async function setAudience(next) {
    if (!data.owner || busy) return;
    if (next === "private" && data.members.length) {
      setError("Remove collaborators before changing this board to Only me.");
      return;
    }
    setAudienceChoice(next);
    const saved = await act("visibility", { visibility: next });
    if (!saved) return;
    setNotice(next === "private" ? "Only you can open this board." : next === "friends" ? "Your accepted Weyn friends can open this board." : "Anyone with the link can open this board.");
  }

  async function shareBoard() {
    if (audienceChoice === "private") {
      setError("Choose Friends or Public before sharing this board.");
      return;
    }
    if (data.board.archived_at) {
      setError("Restore this board before sharing it.");
      return;
    }
    const path = `/b/${data.board.share_slug}`;
    const shareUrl = `${window.location.origin}${path}`;
    if (navigator.share) await navigator.share({ title: data.board.title, url: shareUrl });
    else {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Board link copied.");
    }
  }

  async function inviteFriend() {
    if (!invite.trim()) return;
    const saved = await act("invite", { displayName: invite.trim() });
    if (saved) {
      setInvite("");
      setAudienceChoice("friends");
      setNotice("Collaborator invited. This board is shared only with its members.");
    }
  }

  async function removeBoard() {
    if (!confirm("Delete this board permanently? This cannot be undone.")) return;
    setBusy(true);
    const response = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
    if (response.ok) router.push("/plan");
    else {
      setError((await response.json()).error || "Couldn’t delete this board.");
      setBusy(false);
    }
  }

  if (!data) {
    return <div className={`${styles.pageNarrow} ${styles.empty}`} role="status">{error || "Loading board…"}</div>;
  }

  return (
    <div className={`${styles.page} ${styles.boardPage}`}>
      <header className={styles.header}>
        <span className="eyebrow">{data.board.archived_at ? "Archived board" : "Collaborative board"}</span>
        <h1>{data.board.title}</h1>
        <p className="sub">Choose the audience, invite the right people, then vote and reorder the plan together.</p>
      </header>

      <section className={`card ${styles.boardCard}`}>
        <div className={styles.boardTitleRow}>
          <div className="field">
            <label htmlFor="board-title">Board name</label>
            <input id="board-title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} disabled={!data.owner || busy} />
          </div>
          {data.owner && <button className="btn small" disabled={busy || !title.trim() || title.trim() === data.board.title} onClick={() => act("rename", { title })}>Save name</button>}
        </div>

        <fieldset className={`${styles.audienceGroup} ${styles.boardAudience}`} disabled={!data.owner || busy}>
          <legend>Who can open this board?</legend>
          <div className={styles.audienceOptions}>
            {[
              ["private", "Only me", "No public link or collaborators"],
              ["friends", "Friends", "Accepted Weyn friends"],
              ["public", "Public", "Anyone with the link"],
            ].map(([value, label, help]) => (
              <label className={styles.audienceOption} key={value}>
                <input type="radio" name="board-audience" value={value} checked={audienceChoice === value} onChange={() => setAudience(value)} />
                <strong>{label}</strong>
                <small>{help}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={styles.boardAudienceActions}>
          <button className="btn ghost" type="button" onClick={shareBoard} disabled={busy || audienceChoice === "private" || !!data.board.archived_at}>Share board</button>
          {data.owner && <button className="btn ghost" type="button" onClick={() => act(data.board.archived_at ? "restore" : "archive")} disabled={busy}>{data.board.archived_at ? "Restore board" : "Archive board"}</button>}
          {data.owner && <button className={`btn ghost ${styles.danger}`} type="button" onClick={removeBoard} disabled={busy}>Delete board</button>}
        </div>
      </section>

      {data.owner && (
        <section className={`card ${styles.boardCard}`}>
          <h2>People with access</h2>
          <p className="sub">Invite someone by their exact Weyn username. They can add, remove, reorder, and vote.</p>
          <div className={styles.boardTitleRow}>
            <div className="field">
              <label htmlFor="board-invite">Weyn username</label>
              <input id="board-invite" ref={inviteInputRef} value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="friend_username" />
            </div>
            <button className="btn small" disabled={busy || !invite.trim()} onClick={inviteFriend}>Invite</button>
          </div>
          {!!data.members.length && (
            <div className={styles.linkList}>
              {data.members.map((member) => (
                <div className="details-row" key={member.user_id}>
                  <span>{member.profile?.display_name || "Weyn member"} · {member.role}</span>
                  {member.role === "member" && <button className="btn small ghost" disabled={busy} onClick={() => act("removeMember", { userId: member.user_id })}>Remove</button>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className={styles.panelTitle}>
          <span className="eyebrow">Your route</span>
          <h2>Vote and set the order</h2>
        </div>
        {!data.places.length && <div className={styles.empty}><strong>No places on this board yet.</strong><span>Add places from your planner first.</span></div>}
        <div className={styles.boardPlaceList}>
          {data.places.map((place, index) => (
            <article className={styles.boardPlace} key={place.id}>
              <div className={styles.boardPlaceTop}>
                <div className={styles.boardPlaceName}>
                  <strong>{index + 1}. {place.name}</strong>
                  <span className="sub">{place.neighborhood || place.city || "UAE"} · score {place.score}</span>
                </div>
                <MapChooser venue={place} compact />
              </div>
              <div className={styles.boardControls}>
                <button className={`btn small ${place.myVote === 1 ? "" : "ghost"}`} onClick={() => act("vote", { placeId: place.id, vote: 1 })} aria-label={`Vote for ${place.name}`}>👍</button>
                <button className={`btn small ${place.myVote === -1 ? "" : "ghost"}`} onClick={() => act("vote", { placeId: place.id, vote: -1 })} aria-label={`Vote against ${place.name}`}>👎</button>
                <button className="btn small ghost" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move ${place.name} earlier`}>⬆️</button>
                <button className="btn small ghost" onClick={() => move(index, 1)} disabled={busy || index === data.places.length - 1} aria-label={`Move ${place.name} later`}>⬇️</button>
                <button className={`btn small ghost ${styles.danger}`} onClick={() => act("removePlace", { placeId: place.id })} disabled={busy}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}
      {error && <div className="notice err" role="alert">{error}</div>}
    </div>
  );
}
