"use client";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

export default function InvitationGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/beta-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't verify that code.");
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="invitation-gate" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <div className="invitation-card">
        <div className="invitation-icon"><KeyRound aria-hidden="true" /></div>
        <span className="eyebrow">Private beta</span>
        <h1 id="invite-title">You have a code.</h1>
        <p>Weyn is invite-only in Abu Dhabi and Dubai. Enter it once and you are in.</p>
        <form onSubmit={submit}>
          <label htmlFor="invitation-code">Invitation code</label>
          <input type="text" id="invitation-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="one-time-code" placeholder="WEYN-XXXX" required autoFocus />
          {error && <div className="notice err" role="alert">{error}</div>}
          <button className="btn primary block" type="submit" disabled={busy || !code.trim()}>
            {busy ? <><Loader2 className="invite-spinner" /> Checking…</> : "Enter the beta"}
          </button>
        </form>
        <small>By continuing, you acknowledge that features and data may change during testing.</small>
      </div>
    </div>
  );
}


