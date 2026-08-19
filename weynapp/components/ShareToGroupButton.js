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
    <div style={{ position: "relative", display: "inline-block" }}>
      <button className="btn small ghost" type="button" onClick={toggle}>
        👥 Send to group
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 20,
            background: "var(--white)", border: "1.5px solid var(--ink)", borderRadius: 10,
            boxShadow: "3px 3px 0 var(--ink)", padding: 8, minWidth: 180,
          }}
        >
          {groups === null && <div style={{ fontSize: 13 }}>Loading…</div>}
          {groups?.length === 0 && (
            <div style={{ fontSize: 13 }}>
              No groups yet, <a href="/groups" style={{ fontWeight: 800 }}>make one</a>.
            </div>
          )}
          {groups?.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => sendTo(g.id)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 13, fontWeight: 700, borderRadius: 6 }}
              className="btn-ghost-row"
            >
              {sentTo === g.id ? "Sent ✓" : g.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
