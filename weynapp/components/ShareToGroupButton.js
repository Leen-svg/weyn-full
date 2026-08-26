"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ShareToGroupButton({ text, share = null }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState(null);
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && groups === null) {
      const res = await fetch("/api/groups");
      const d = await res.json();
      if (res.status === 401) setNeedsLogin(true);
      setGroups(res.ok ? d.groups || [] : []);
    }
  }

  async function sendTo(groupId) {
    setError(null);
    const res = await fetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, share }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not send to that group");
      return;
    }
    setSentTo(groupId);
    setTimeout(() => setOpen(false), 900);
  }

  const sheet = open && typeof document !== "undefined" ? createPortal(
    <div className="group-share-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className="group-share-menu" role="dialog" aria-modal="true" aria-label="Send to a recent group">
        <div className="group-share-heading">
          <div>
            <span>Share in Weyn</span>
            <strong>Send to a recent group</strong>
          </div>
          <button type="button" className="group-share-close" aria-label="Close group picker" onClick={() => setOpen(false)}>×</button>
        </div>
        {groups === null && <div className="group-share-empty">Loading your groups…</div>}
        {needsLogin && (
          <a className="group-share-login" href="/login?next=/app">
            <span><b>Log in to see your groups</b><small>Your recent Weyn groups will appear here.</small></span>
            <span>Log in →</span>
          </a>
        )}
        {!needsLogin && groups?.length === 0 && (
          <div className="group-share-empty">
            No groups yet. <a href="/groups">Create one</a> or share a link instead.
          </div>
        )}
        {groups?.map((g) => (
          <button key={g.id} type="button" onClick={() => sendTo(g.id)} className="group-share-option">
            <span>
              <b>{g.name}</b>
              <small>{g.members?.length || 0} member{g.members?.length === 1 ? "" : "s"}</small>
            </span>
            <span>{sentTo === g.id ? "Sent ✓" : "Send →"}</span>
          </button>
        ))}
        {error && <div className="group-share-error" role="alert">{error}</div>}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="group-share-control">
      <button className="btn small ghost" type="button" onClick={toggle} aria-expanded={open}>
        👥 Send to group
      </button>
      {sheet}
    </div>
  );
}

