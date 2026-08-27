"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    });
    if (error) setErr(error.message);
    else setSent(true);
    setBusy(false);
  }

  return (
    <>
      <h1>Reset your password</h1>
      <p className="sub">We&apos;ll email you a link to set a new one.</p>
      {sent ? (
        <div className="notice">Check {email} for a reset link.</div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          {err && <div className="notice err">{err}</div>}
          <button className="btn btn-full" disabled={busy} type="submit">
            {busy ? "…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="sub" style={{ marginTop: 18, fontSize: 14 }}>
        <a href="/login">Back to log in</a>
      </p>
    </>
  );
}

