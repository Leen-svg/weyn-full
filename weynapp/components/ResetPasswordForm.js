"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "./PasswordInput";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErr(error.message);
    else {
      setDone(true);
      setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 1500);
    }
    setBusy(false);
  }

  return (
    <>
      <h1>Set a new password</h1>
      {done ? (
        <div className="notice">Password updated, taking you in…</div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <PasswordInput id="new-password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          {err && <div className="notice err">{err}</div>}
          <button className="btn block" disabled={busy} type="submit">
            {busy ? "…" : "Update password"}
          </button>
        </form>
      )}
    </>
  );
}

