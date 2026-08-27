"use client";
import { useState } from "react";
import { safeUrl } from "@/lib/sanitize";
import ShareToGroupButton from "./ShareToGroupButton";

export default function VenueActions({ venue, initialSaved = false, onRemoved }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [quietLoud, setQuietLoud] = useState(50);
  const [walletSplurge, setWalletSplurge] = useState(50);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState(null);
  const [visibility, setVisibility] = useState("");
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
    if (!rating) {
      setReviewMsg("Choose an overall rating from 1 to 5 stars.");
      return;
    }
    if (!visibility) {
      setReviewMsg("Choose Private, Friends, or Public before submitting your review.");
      return;
    }
    setBusy(true);
    setNeedsLogin(false);
    try {
      let mediaId = null;
      if (photo) {
        const upload = new FormData();
        upload.set("file", photo);
        upload.set("contextType", "review");
        upload.set("venueId", venue.id);
        upload.set("visibility", visibility);
        const uploadResponse = await fetch("/api/media-upload", { method: "POST", body: upload });
        const uploadBody = await uploadResponse.json();
        if (uploadResponse.status === 401) setNeedsLogin(true);
        if (!uploadResponse.ok) throw new Error(uploadBody.error || "Couldn't upload that photo");
        mediaId = uploadBody.mediaId;
      }
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, rating, body, mediaId, visibility, quietLoud, walletSplurge }),
      });
      if (res.status === 401) setNeedsLogin(true);
      else if (res.ok) {
        const d = await res.json();
        const photoNote = d.photoStatus === "pending" ? " Your photo is private while it is reviewed." : "";
        setReviewMsg((d.pointsEarned ? `Thanks, saved. +${d.pointsEarned} points 🏅` : "Thanks, saved.") + photoNote);
        setRateOpen(false);
        setPhoto(null);
        setVisibility("");
        if (reviewsOpen) loadReviews();
      } else {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't save that review");
      }
    } catch (error) {
      setReviewMsg(error.message || "Couldn't save that, try again.");
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
        <ShareToGroupButton text={`📍 Check out ${venue.name}${venue.neighborhood ? ` in ${venue.neighborhood}` : ""}.`} share={{ type: "venue", id: venue.id }} />
      </div>

      {needsLogin && (
        <div className="notice" style={{ marginTop: 10 }}>
          <a href="/signup" style={{ fontWeight: 800 }}>Sign up</a> to save spots and leave reviews.
        </div>
      )}

      {rateOpen && (
        <div style={{ marginTop: 12 }}>
          <div className="details-card">
            <fieldset className="field">
              <legend>Overall rating</legend>
              <div className="review-star-picker" role="radiogroup" aria-label="Overall rating">
                {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? "" : "s"}`} onClick={() => setRating(value)}>{value <= rating ? "⭐" : "☆"}</button>)}
              </div>
            </fieldset>
            <label className="field"><span>Atmosphere <small>Quiet — Lively</small></span><input type="range" min="0" max="100" value={quietLoud} onChange={(e) => setQuietLoud(Number(e.target.value))} /></label>
            <label className="field"><span>Price feel <small>Budget — Splurge</small></span><input type="range" min="0" max="100" value={walletSplurge} onChange={(e) => setWalletSplurge(Number(e.target.value))} /></label>
          </div>
          <textarea
            placeholder="What was it like? (optional)"
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <label className="field" style={{ marginTop: 8 }}><span>Add a photo <small>JPG, PNG, or WebP · max 5 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label>
          <fieldset className="field audience-picker" style={{ marginTop: 8 }}>
            <legend>Who can see this review?</legend>
            <div className="chips" role="radiogroup" aria-label="Review audience">
              {[['private', '🔒 Private'], ['friends', '👋 Friends'], ['public', '🌍 Public']].map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={visibility === value} className={`chip ${visibility === value ? "sel" : ""}`} onClick={() => setVisibility(value)}>{label}</button>)}
            </div>
            <small>{!visibility ? "Choose an audience before submitting." : visibility === "private" ? "Only you can see it." : visibility === "friends" ? "Only accepted friends can see it." : "Anyone can see it on Weyn."}</small>
          </fieldset>
          <p className="sub" style={{ marginTop: 8 }}>Photos stay private in quarantine until an admin approves them.</p>
          <button className="btn small btn-full" style={{ marginTop: 8 }} disabled={busy || !rating || !visibility} onClick={submitReview}>
            {busy ? "Saving…" : "Submit review"}
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
                <span>{"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</span>
              </div>
              {(r.quiet_loud != null || r.wallet_splurge != null) && <div className="sub" style={{ fontSize: 12 }}>{r.quiet_loud != null ? `${r.quiet_loud}% lively` : ""}{r.quiet_loud != null && r.wallet_splurge != null ? " · " : ""}{r.wallet_splurge != null ? `${r.wallet_splurge}% splurge` : ""}</div>}
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
