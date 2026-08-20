"use client";
import { useMemo, useState, useEffect } from "react";
import { safeUrl } from "@/lib/sanitize";
import MapChooser from "./MapChooser";

function getFingerprint() {
  let fp = localStorage.getItem("weyn_fp");
  if (!fp) { fp = crypto.randomUUID(); localStorage.setItem("weyn_fp", fp); }
  return fp;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function RateClient({ venues, allTags }) {
  const [order, setOrder] = useState([]);
  const [i, setI] = useState(0);
  const [mode, setMode] = useState(null); // null | 'wrong' | 'missing'
  const [pick, setPick] = useState(null);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => { setOrder(shuffle(venues.map((v) => v.id))); }, [venues]);

  const venue = useMemo(() => venues.find((v) => v.id === order[i]), [venues, order, i]);

  function next() {
    setMode(null); setPick(null); setComment("");
    setI((n) => (n + 1) % Math.max(1, order.length));
  }

  async function send(vote, tag_slug, suggested_tag_slug) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/tag-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venue_id: venue.id, vote, tag_slug, suggested_tag_slug,
        comment: comment.trim() || null, fingerprint: getFingerprint(),
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg({ err: true, text: d.error }); return; }
    setDone((n) => n + 1);
    setMsg({ err: false, text: "Logged, thank you!" });
    setTimeout(() => { setMsg(null); next(); }, 700);
  }

  if (!venue) return <p className="sub">Loading venues…</p>;

  return (
    <div>
      <div className="card">
        <div className="venue-name">{venue.name}</div>
        <div className="venue-meta">
          {venue.neighborhood} · {venue.avg_spend_aed === 0 ? "Free entry" : `~${venue.avg_spend_aed} AED`}
        </div>
        <div className="venue-links" style={{ marginBottom: 14 }}>
          {safeUrl(venue.hero_video_url) && <a className="btn small ghost" href={safeUrl(venue.hero_video_url)} target="_blank" rel="noreferrer">▶ Watch</a>}
          <MapChooser venue={venue} compact />
        </div>

        <h2 className="group-label">Tagged as</h2>
        <div className="tag-row">
          {venue.tagList.map((t) => <span key={t.slug} className="tag-pill">{t.display_name}</span>)}
        </div>

        {msg && <div className={`notice ${msg.err ? "err" : ""}`}>{msg.text}</div>}

        {!mode && (
          <div className="cta-row" style={{ marginTop: 18 }}>
            <button className="btn primary" disabled={busy} onClick={() => send("fits", null, null)}>👍 Feels right</button>
            <button className="btn ghost" disabled={busy} onClick={() => setMode("wrong")}>✋ Tag is wrong</button>
            <button className="btn ghost" disabled={busy} onClick={() => setMode("missing")}>➕ Missing one</button>
          </div>
        )}

        {mode === "wrong" && (
          <div style={{ marginTop: 16 }}>
            <h2 className="group-label">Which tag doesn&apos;t belong?</h2>
            <div className="chips">
              {venue.tagList.map((t) => (
                <button key={t.slug} className={`chip ${pick === t.slug ? "sel" : ""}`} onClick={() => setPick(t.slug)}>
                  {t.display_name}
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label>Why? <span className="hint">(optional)</span></label>
              <input type="text" maxLength={200} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div className="cta-row">
              <button className="btn" disabled={!pick || busy} onClick={() => send("wrong_tag", pick, null)}>Send</button>
              <button className="btn ghost" onClick={() => { setMode(null); setPick(null); }}>Cancel</button>
            </div>
          </div>
        )}

        {mode === "missing" && (
          <div style={{ marginTop: 16 }}>
            <h2 className="group-label">Which tag should it have?</h2>
            <div className="chips">
              {allTags.filter((t) => !venue.tagList.some((x) => x.slug === t.slug)).map((t) => (
                <button key={t.slug} className={`chip ${pick === t.slug ? "sel" : ""}`} onClick={() => setPick(t.slug)}>
                  {t.display_name}
                </button>
              ))}
            </div>
            <div className="cta-row">
              <button className="btn" disabled={!pick || busy} onClick={() => send("missing_tag", null, pick)}>Send</button>
              <button className="btn ghost" onClick={() => { setMode(null); setPick(null); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="sub" style={{ margin: 0 }}>{done} rated this session</span>
        <button className="btn ghost small" onClick={next}>Skip →</button>
      </div>
    </div>
  );
}
