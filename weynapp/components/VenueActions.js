"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/sanitize";
import ShareToGroupButton from "./ShareToGroupButton";

const STARS = [1, 2, 3, 4, 5];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function VenueActions({ venue, initialSaved = false, onRemoved }) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState(null);
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

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Photos only, JPG, PNG, WEBP or GIF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That photo's too big, 5MB max.");
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submitReview() {
    if (!rating) return;
    setBusy(true);
    setNeedsLogin(false);
    try {
      let photoUrl = null;
      if (photoFile) {
        const { createClient } = await import("@/lib/supabase/client");\n        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setNeedsLogin(true);
          setBusy(false);
          return;
        }
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${venue.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("review-photos").upload(path, photoFile, { contentType: photoFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, rating, body, photoUrl }),
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
          <div className="star-row">
            {STARS.map((n) => (
              <button
                key={n}
                type="button"
                className={`star ${n <= rating ? "on" : ""}`}
                onClick={() => setRating(n)}
                aria-label={`${n} star`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            placeholder="What was it like? (optional)"
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
            {photoPreview && (
              <img src={photoPreview} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10, border: "2px solid var(--ink)" }} />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickPhoto} />
          </div>
          {photoError && <div className="notice err" style={{ marginTop: 8 }}>{photoError}</div>}
          <button className="btn small block" style={{ marginTop: 8 }} disabled={busy || !rating} onClick={submitReview}>
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
                <span>{"★".repeat(r.rating)}</span>
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

