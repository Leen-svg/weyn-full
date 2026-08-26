"use client";
import { useState, useEffect, useCallback } from "react";
import { safeUrl } from "@/lib/sanitize";

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [activity, setActivity] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query) => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query || "")}`);
    const d = await res.json();
    if (res.ok) setUsers(d.users || []);
  }, []);

  useEffect(() => { load(""); }, [load]);

  async function openUser(id) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setActivity(null);
    const res = await fetch(`/api/admin/users/${id}`);
    const d = await res.json();
    if (res.ok) setActivity(d);
  }

  async function toggleBan(u) {
    setBusy(true);
    const reason = u.is_banned ? null : prompt("Ban reason (optional):") || null;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !u.is_banned, reason }),
    });
    setBusy(false);
    load(q);
  }

  return (
    <div>
      <div className="field">
        <label>Search by display name</label>
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value); }} placeholder="Search…" />
      </div>

      {users.map((u) => (
        <div className="card" key={u.id}>
          <div className="admin-row">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {safeUrl(u.avatar_url) && <img src={safeUrl(u.avatar_url)} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />}
              <div>
                <div className="venue-name" style={{ fontSize: 15 }}>
                  {u.display_name || "Unnamed"} {u.is_admin && <span className="tag-pill">admin</span>} {u.is_banned && <span className="tag-pill" style={{ background: "var(--pink-wash)" }}>banned</span>}
                </div>
                <div className="venue-meta">
                  {u.points_balance} pts · {u.review_count} reviews · {u.save_count} saves · joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="admin-actions">
              <button className="btn small ghost" onClick={() => openUser(u.id)}>{openId === u.id ? "Close" : "View"}</button>
              {!u.is_admin && (
                <button className="btn small ghost" disabled={busy} onClick={() => toggleBan(u)}>
                  {u.is_banned ? "Unban" : "Ban"}
                </button>
              )}
            </div>
          </div>
          {openId === u.id && (
            <div style={{ marginTop: 12, borderTop: "2px solid var(--ink)", paddingTop: 12 }}>
              {!activity && <p className="sub">Loading…</p>}
              {activity && (
                <>
                  <strong style={{ fontSize: 13 }}>Reviews ({activity.reviews.length})</strong>
                  {activity.reviews.map((r) => (
                    <div key={r.id} className="mono" style={{ marginTop: 4 }}>
                      {r.venues?.name}: {r.aesthetic_taste ?? 50}% taste · {r.quiet_loud ?? 50}% loud · {r.wallet_splurge ?? 50}% splurge, {r.body || "(no comment)"}
                    </div>
                  ))}
                  <strong style={{ fontSize: 13, display: "block", marginTop: 10 }}>Saved spots ({activity.saves.length})</strong>
                  <div className="tag-row">
                    {activity.saves.map((sv) => <span key={sv.venue_id} className="tag-pill">{sv.venues?.name}</span>)}
                  </div>
                  <strong style={{ fontSize: 13, display: "block", marginTop: 10 }}>Posts ({activity.posts.length})</strong>
                  {activity.posts.map((p) => (
                    <div key={p.id} className="mono" style={{ marginTop: 4 }}>
                      [{p.visibility}] {p.venues?.name}, {p.body}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

