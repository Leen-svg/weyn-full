"use client";
import { useEffect, useState, useCallback } from "react";
import VenueCard from "./VenueCard";

function getFingerprint() {
  let fp = localStorage.getItem("weyn_fp");
  if (!fp) { fp = crypto.randomUUID(); localStorage.setItem("weyn_fp", fp); }
  return fp;
}

export default function GuestVoteClient({ token }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [name, setName] = useState("");
  const [voted, setVoted] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/vote/${token}`);
    const d = await res.json();
    if (!res.ok) { setErr(d.error); return; }
    setData(d);
  }, [token]);

  useEffect(() => {
    load();
    setName(localStorage.getItem("weyn_name") || "");
    setVoted(localStorage.getItem(`weyn_group_voted_${token}`));
  }, [token, load]);

  async function vote(optionId) {
    setBusy(true); setErr(null);
    localStorage.setItem("weyn_name", name);
    const res = await fetch(`/api/vote/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, name, fingerprint: getFingerprint() }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error);
    else {
      localStorage.setItem(`weyn_group_voted_${token}`, optionId);
      setVoted(optionId);
      load();
    }
    setBusy(false);
  }

  if (err && !data) return <div className="notice err">{err}</div>;
  if (!data) return <p className="sub">Loading the vote…</p>;

  const max = Math.max(1, ...data.options.map((o) => o.votes));

  return (
    <div className="vote-flow">
      <h1>{data.groupName ? `${data.groupName} is deciding.` : "Pick one."}</h1>
      <p className="sub">{data.expired ? "Voting has closed, here's the verdict." : "Tap your pick. You don't need the app to vote."}</p>

      {!data.expired && (
        <div className="field">
          <label>Your name <span className="hint">(so they know who voted)</span></label>
          <input type="text" value={name} maxLength={40} placeholder="e.g. Sara" onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      {err && <div className="notice err">{err}</div>}

      <div className="venue-list-single">
      {data.options.map((o) => (
        <VenueCard key={o.optionId} venue={o.venue} picked={voted === o.optionId}>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, gap: 8 }}>
              <span>
                {o.votes} vote{o.votes === 1 ? "" : "s"}
                {o.voters.length ? `, ${o.voters.join(", ")}` : ""}
              </span>
              {voted === o.optionId && <span style={{ color: "var(--purple)" }}>✓ your pick</span>}
            </div>
            <div className="result-bar">
              <div className={`result-fill${o.votes === max && o.votes > 0 ? " lead" : ""}`} style={{ width: `${(o.votes / max) * 100}%` }} />
            </div>
            {!data.expired && (
              <button className={`btn small block${voted === o.optionId ? " primary" : ""}`} style={{ marginTop: 12 }} disabled={busy} onClick={() => vote(o.optionId)}>
                {voted === o.optionId ? "Voted ✓" : "Vote for this"}
              </button>
            )}
          </div>
        </VenueCard>
      ))}
      </div>

      <p className="sub" style={{ marginTop: 22 }}>
        powered by <a href="/" style={{ fontWeight: 800, color: "var(--ink)" }}>weyn</a>
      </p>
    </div>
  );
}


