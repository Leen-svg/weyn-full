"use client";
import { useState } from "react";
import { safeUrl } from "@/lib/sanitize";
import ShareToGroupButton from "./ShareToGroupButton";

export default function VenueActions({ venue, initialSaved = false, onRemoved }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [aestheticTaste, setAestheticTaste] = useState(50);
  const [quietLoud, setQuietLoud] = useState(50);
  const [walletSplurge, setWalletSplurge] = useState(50);
  const [body, setBody] = useState("");
  const [reviewMsg, setReviewMsg] = useState(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviews, setReviews] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  async function toggleSave() {
    setBusy(true);
    setNeedsLogin(false);
    const method = saved ? "DELETE" : "POST";
    const res = await fetch("/api/saves", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: venue.id }),
    });
    if (res.status === 401) {
      setNeedsLogin(true);
    } else if (res.ok) {
      const next = !saved;
      setSaved(next);
      if (!next && onRemoved) onRemoved(venue.id);
    }
    setBusy(false);
  }

  async function submitReview() {
    const rating = Math.max(1, Math.min(5, Math.round((aestheticTaste + (100 - quietLoud) + (100 - walletSplurge)) / 75)));
    setBusy(true);
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, rating, body, aestheticTaste, quietLoud, walletSplurge }),
      });
      if (res.status === 401) setNeedsLogin(true);
      else if (res.ok) {
        const d = await res.json();
        setReviewMsg(d.pointsEarned ? `Thanks, saved. +${d.pointsEarned} points 🏅` : "Thanks, saved.");
        setRateOpen(false);
        if (reviewsOpen) loadReviews();
      }
    } catch {
      setReviewMsg("Couldn't save that, try again.");
    }
    setBusy(false);
  }

  async function loadReviews() {
    setLoadingReviews(true);
    const res = await fetch(`/api/reviews?venue_id=${venue.id}`);
    const d = await res.json();
    if (res.ok) setReviews(d.reviews || []);
    setLoadingReviews(false);
    // best-effort points for engaging with a venue's reviews, no-ops for guests
    // and for venues you've already engaged with (server-side dedup).
    fetch(`/api/venues/${venue.id}/view`, { method: "POST" }).catch(() => {});
  }

  function toggleReviews() {
    const next = !reviewsOpen;
    setReviewsOpen(next);
    if (next && reviews === null) loadReviews();
  }

  return (
    <div className="venue-actions">
      <div className="venue-links venue-action-bar" style={{ marginTop: 10 }}>
        <button className={`btn small ${saved ? "" : "ghost"}`} disabled={busy} onClick={toggleSave} type="button">
          {saved ? "★ Saved" : "☆ Save"}
        </button>
        <button className="btn small ghost" onClick={() => setRateOpen((v) => !v)} type="button">
          ⭐ Rate it
        </button>
        <button className="btn small ghost" onClick={toggleReviews} type="button">
          💬 Reviews
        </button>
        <ShareToGroupButton text={`📍 Check out ${venue.name} (${venue.neighborhood || ""}), ${safeUrl(venue.google_maps_url) || ""}`} />
      </div>

      {needsLogin && (
        <div className="notice" style={{ marginTop: 10 }}>
          <a href="/signup" style={{ fontWeight: 800 }}>Sign up</a> to save spots and leave reviews.
        </div>
      )}

      {rateOpen && (
        <div style={{ marginTop: 12 }}>
          <div className="details-card">
            <label className="field"><span>Aesthetic ↔ Taste</span><input type="range" min="0" max="100" value={aestheticTaste} onChange={(e) => setAestheticTaste(Number(e.target.value))} /></label>
            <label className="field"><span>Quiet ↔ Loud</span><input type="range" min="0" max="100" value={quietLoud} onChange={(e) => setQuietLoud(Number(e.target.value))} /></label>
            <label className="field"><span>Wallet-friendly ↔ Splurge</span><input type="range" min="0" max="100" value={walletSplurge} onChange={(e) => setWalletSplurge(Number(e.target.value))} /></label>
          </div>
          <textarea
            placeholder="What was it like? (optional)"
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <p className="sub" style={{ marginTop: 8 }}>Photo uploads are paused while stronger image moderation is added.</p>
          <button className="btn small block" style={{ marginTop: 8 }} disabled={busy} onClick={submitReview}>
            Submit review
          </button>
        </div>
      )}

      {reviewMsg && <div className="notice" style={{ marginTop: 10 }}>{reviewMsg}</div>}

      {reviewsOpen && (
        <div style={{ marginTop: 12 }}>
          {loadingReviews && <p className="sub" style={{ marginBottom: 0 }}>Loading reviews…</p>}
          {!loadingReviews && reviews?.length === 0 && <p className="sub" style={{ marginBottom: 0 }}>No reviews yet, be the first.</p>}
          {reviews?.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid var(--ink)", paddingTop: 8, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span>{r.profile_public?.display_name || "Someone"}</span>
                <span>{r.aesthetic_taste ?? 50}% taste · {r.quiet_loud ?? 50}% loud · {r.wallet_splurge ?? 50}% splurge</span>
              </div>
              {r.body && <p style={{ fontSize: 14, marginTop: 4 }}>{r.body}</p>}
              {safeUrl(r.photo_url) && (
                <img src={safeUrl(r.photo_url)} alt="" style={{ marginTop: 6, width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "2px solid var(--ink)" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
