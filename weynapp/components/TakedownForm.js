"use client";
import { useState } from "react";

export default function TakedownForm() {
  const [f, setF] = useState({ video_url: "", creator_handle: "", contact_email: "", reason: "" });
  const [state, setState] = useState({ busy: false, done: false, err: null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, err: null });
    const res = await fetch("/api/takedowns", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const d = await res.json();
    if (!res.ok) setState({ busy: false, done: false, err: d.error });
    else setState({ busy: false, done: true, err: null });
  }

  if (state.done) {
    return (
      <div className="notice">
        Request received. The video is flagged and will be pulled within 48 hours, you&apos;ll get a
        confirmation if you left an email.
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Link to the video on Weyn *</label>
        <input type="url" required value={f.video_url} onChange={set("video_url")}
          placeholder="https://www.tiktok.com/@you/video/…" />
      </div>
      <div className="field">
        <label>Your TikTok handle *</label>
        <input type="text" required maxLength={40} value={f.creator_handle} onChange={set("creator_handle")}
          placeholder="@yourhandle" />
        <span className="hint">Must match the account that posted the video.</span>
      </div>
      <div className="field">
        <label>Email <span className="hint">(for confirmation)</span></label>
        <input type="email" value={f.contact_email} onChange={set("contact_email")} />
      </div>
      <div className="field">
        <label>Anything you want us to know? <span className="hint">(optional)</span></label>
        <textarea maxLength={400} value={f.reason} onChange={set("reason")} />
      </div>
      {state.err && <div className="notice err">{state.err}</div>}
      <div className="cta-row">
        <button className="btn btn-full" type="submit" disabled={state.busy}>
          {state.busy ? "Sending…" : "Request removal"}
        </button>
      </div>
    </form>
  );
}

