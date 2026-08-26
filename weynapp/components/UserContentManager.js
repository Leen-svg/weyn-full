"use client";

import { useEffect, useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";

const AUDIENCES = [["private", "Private"], ["friends", "Friends"], ["public", "Public"]];

export default function UserContentManager() {
  const [content, setContent] = useState(null);
  const [view, setView] = useState("active");
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/my-content", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) setError(body.error || "Couldn’t load your content");
    else setContent(body);
  }

  useEffect(() => { load(); }, []);

  async function update(item, action, visibility) {
    const key = `${item.type}:${item.id}`;
    if (action === "delete" && !window.confirm(`Delete this ${item.type} permanently?`)) return;
    setBusyKey(key); setError("");
    try {
      const response = await fetch(item.type === "post" ? "/api/posts" : "/api/reviews", {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "delete" ? { id: item.id } : { id: item.id, action, visibility }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn’t update that item");
      await load();
    } catch (updateError) {
      setError(updateError.message || "Couldn’t update that item");
    } finally {
      setBusyKey("");
    }
  }

  const items = content ? [
    ...content.posts.map((item) => ({ ...item, type: "post", place: item.venues?.name || item.saved_lists?.title || "Shared collection" })),
    ...content.reviews.map((item) => ({ ...item, type: "review", place: item.venues?.name || "Place review" })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
  const visible = items.filter((item) => view === "archived" ? !!item.archived_at : !item.archived_at);

  return (
    <div className="content-manager">
      <div className="community-segmented content-manager__tabs" role="tablist" aria-label="Content state">
        <button type="button" role="tab" aria-selected={view === "active"} className={view === "active" ? "active" : ""} onClick={() => setView("active")}>Active</button>
        <button type="button" role="tab" aria-selected={view === "archived"} className={view === "archived" ? "active" : ""} onClick={() => setView("archived")}>Archived</button>
      </div>
      {error && <div className="notice err" role="alert">{error}</div>}
      {!content && !error && <p className="sub">Loading your posts and reviews…</p>}
      {content && !visible.length && <div className="discover-empty">No {view} posts or reviews.</div>}
      <div className="content-manager__list">
        {visible.map((item) => {
          const key = `${item.type}:${item.id}`;
          return (
            <article className="content-manager__item" key={key}>
              <div className="content-manager__meta"><span>{item.type}{item.type === "review" && item.rating ? ` · ${item.rating}/5` : ""}</span><time>{new Date(item.created_at).toLocaleDateString()}</time></div>
              <h2>{item.place}</h2>
              {item.body && <p>{item.body}</p>}
              <div className="content-manager__controls">
                <fieldset disabled={busyKey === key}>
                  <legend>Audience</legend>
                  <div className="chips" role="radiogroup" aria-label={`${item.type} audience`}>
                    {AUDIENCES.map(([value, label]) => <button type="button" role="radio" aria-checked={item.visibility === value} className={`chip ${item.visibility === value ? "sel" : ""}`} onClick={() => update(item, "visibility", value)} key={value}>{label}</button>)}
                  </div>
                </fieldset>
                <div>
                  <button className="btn small ghost" type="button" disabled={busyKey === key} onClick={() => update(item, item.archived_at ? "restore" : "archive")}>{item.archived_at ? <RotateCcw /> : <Archive />}{item.archived_at ? "Restore" : "Archive"}</button>
                  <button className="btn small ghost danger" type="button" disabled={busyKey === key} onClick={() => update(item, "delete")}><Trash2 /> Delete</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
