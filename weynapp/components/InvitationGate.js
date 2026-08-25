"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

const OPEN = ["/login", "/forgot-password", "/reset-password", "/auth"];

export default function InvitationGate() {
  const pathname = usePathname() || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

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
        <p>Weyn is invite-only in Abu Dhabi and Dubai. Enter it once and you are in. Log in if you already have an account.</p>
        <form onSubmit={submit}>
          <label htmlFor="invitation-code">Invitation code</label>
          <input
            type="text"
            id="invitation-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder="YALLA WEYN"
            required
            autoFocus
          />
          {error && <div className="notice err" role="alert">{error}</div>}
          <button className="btn primary block" type="submit" disabled={busy || !code.trim()}>
            {busy ? <><Loader2 className="invite-spinner" /> Checking…</> : "Enter the beta"}
          </button>
        </form>
        <p><a href="/login">I already have an account</a></p>
        <small>By continuing, you acknowledge that features and data may change during testing.</small>
      </div>
    </div>
  );
}
