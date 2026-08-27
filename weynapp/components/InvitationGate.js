"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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
      window.location.assign("/signup");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="welcome-hero">
      <div className="welcome-hero__copy">
        <p className="eyebrow">Invitation-only beta</p>
        <h1>Enter your code</h1>
        <p className="sub">Your invitation unlocks account creation for Weyn in Abu Dhabi and Dubai.</p>
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
          {error && (
            <div className="notice err" role="alert">
              {error}
            </div>
          )}
          <button className="btn primary btn-full" type="submit" disabled={busy || !code.trim()}>
            {busy ? (
              <>
                <Loader2 className="invite-spinner" /> Checking…
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
        <p>
          <a href="/login">Already have an account? Log in</a>
        </p>
      </div>
    </section>
  );
}
