"use client";
import { useState } from "react";

export default function ShareToGroupButton({ text }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && groups === null) {
      const res = await fetch("/api/groups");
      const d = await res.json();
      setGroups(res.ok ? d.groups || [] : []);
    }
  }

  async function sendTo(groupId) {
    await fetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setSentTo(groupId);
    setTimeout(() => setOpen(false), 900);
  }

  return (
    <div className="group-share-control">
      <button className="btn small ghost" type="button" onClick={toggle}>
        👥 Send to group
      </button>
      {open && (
        <div className="group-share-menu" role="dialog" aria-label="Send to a recent group">
          <strong>Recent groups</strong>
          {groups === null && <div className="group-share-empty">Loading…</div>}
          {groups?.length === 0 && (
            <div className="group-share-empty">
              No groups yet, <a href="/groups" style={{ fontWeight: 800 }}>make one</a>.
            </div>
          )}
          {groups?.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => sendTo(g.id)}
              className="group-share-option"
            >
              <span>{g.name}</span>
              <span>{sentTo === g.id ? "Sent ✓" : "Send →"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

