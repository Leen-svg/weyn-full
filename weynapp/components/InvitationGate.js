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
        <p className="eyebrow">Private beta</p>
        <h1>
          Code
          <br />
          first.
        </h1>
        <p className="sub">Invite-only in Abu Dhabi and Dubai. Enter a code, then create your account.</p>
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
          <button className="btn primary block" type="submit" disabled={busy || !code.trim()}>
            {busy ? (
              <>
                <Loader2 className="invite-spinner" /> Checking…
              </>
            ) : (
              "Continue to sign up"
            )}
          </button>
        </form>
        <p>
          <a href="/login">I already have an account</a>
        </p>
      </div>
    </section>
  );
}
