"use client";
import { useState } from "react";

export default function CreatorForm({ venues }) {
  const [venueId, setVenueId] = useState("");
  const [venueFree, setVenueFree] = useState("");
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ busy: false, done: false, err: null });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, err: null });
    const res = await fetch("/api/video-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venue_id: venueId || null,
        venue_name_free: venueId ? null : venueFree,
        tiktok_url: url, creator_handle: handle, contact_email: email,
      }),
    });
    const d = await res.json();
    if (!res.ok) setState({ busy: false, done: false, err: d.error });
    else {
      setState({ busy: false, done: true, err: null });
      setUrl(""); setVenueId(""); setVenueFree("");
    }
  }

  if (state.done) {
    return (
      <div>
        <div className="notice">
          Submitted ✅ We review videos weekly. If it&apos;s featured you&apos;ll see your handle on the venue card.
        </div>
        <button className="btn ghost" onClick={() => setState({ busy: false, done: false, err: null })}>
          Submit another video
        </button>
      </div>
    );
  }

  const noVideo = venues.filter((v) => !v.hero_video_url);

  return (
    <form onSubmit={submit}>
      {noVideo.length > 0 && (
        <div className="notice">
          <strong>{noVideo.length} spot{noVideo.length === 1 ? "" : "s"} still need a video</strong>, those get
          approved fastest.
        </div>
      )}

      <div className="field">
        <label>Which spot? *</label>
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          <option value="">Not listed yet / other</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.neighborhood}){v.hero_video_url ? "" : " · needs video"}
            </option>
          ))}
        </select>
      </div>

      {!venueId && (
        <div className="field">
          <label>Venue name *</label>
          <input type="text" required={!venueId} maxLength={120} value={venueFree}
            onChange={(e) => setVenueFree(e.target.value)} placeholder="Name of the place in your video" />
        </div>
      )}

      <div className="field">
        <label>TikTok video link *</label>
        <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.tiktok.com/@you/video/…" />
      </div>

      <div className="field">
        <label>Your TikTok handle *</label>
        <input type="text" required maxLength={40} value={handle} onChange={(e) => setHandle(e.target.value)}
          placeholder="@yourhandle" />
        <span className="hint">Must match the account in the link, that&apos;s how we verify ownership.</span>
      </div>

      <div className="field">
        <label>Email <span className="hint">(so we can tell you when it goes live)</span></label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {state.err && <div className="notice err">{state.err}</div>}

      <div className="cta-row">
        <button className="btn btn-full" type="submit" disabled={state.busy}>
          {state.busy ? "Sending…" : "Submit video"}
        </button>
      </div>

      <p className="sub" style={{ marginTop: 20, fontSize: 13 }}>
        By submitting you confirm the video is yours and you&apos;re happy for Weyn to link to it. You can request
        removal any time via the <a href="/takedown">takedown form</a>.
      </p>
    </form>
  );
}

