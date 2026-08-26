"use client";
import { useState } from "react";

export default function ReportButton({ contentType, contentId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMessage(null);
    const res = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, contentId, reason }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Reported. Thank you for helping keep Weyn safe." : data.error || "Couldn't report that.");
    if (res.ok) setOpen(false);
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" className="btn small ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>Report</button>
      {open && <div className="notice" style={{ marginTop: 6 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700 }}>Why are you reporting this?</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 6, width: "100%" }}>
          <option value="inappropriate">Inappropriate content</option>
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="other">Other</option>
        </select>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button type="button" className="btn small" disabled={busy} onClick={submit}>Send report</button>
          <button type="button" className="btn small ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>}
      {message && <div className="mono" role="status" style={{ marginTop: 5 }}>{message}</div>}
    </div>
  );
}


