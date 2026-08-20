"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "./PasswordInput";

export default function AuthForm({ mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, real users never see or fill this
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (website) return; // bot filled the hidden field, silently drop
    setBusy(true);
    setErr(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setErr(error.message);
      else {
        setNotice("Check your email to confirm your account, then you're in, with 200 points waiting.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
      else {
        router.push(next);
        router.refresh();
      }
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
    }
  }

  return (
    <>
      <h1>{mode === "signup" ? "Join weyn" : "Welcome back"}</h1>
      <p className="sub">
        {mode === "signup"
          ? "Free spots, saved wishlists, and 200 points to start. Beta perk, no catch."
          : "Log in to pick up where you left off."}
      </p>

      <button className="btn ghost block" disabled={busy} onClick={google} type="button">
        Continue with Google
      </button>

      <div className="or-divider"><span>or</span></div>

      <form onSubmit={submit}>
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="auth-password">
            Password
            {mode === "login" && (
              <a href="/forgot-password" style={{ float: "right", fontWeight: 700, fontSize: 13 }}>
                Forgot?
              </a>
            )}
          </label>
          <PasswordInput
            id="auth-password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {err && <div className="notice err">{err}</div>}
        {notice && <div className="notice">{notice}</div>}

        <button className="btn primary block" disabled={busy} type="submit">
          {busy ? "…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="sub" style={{ marginTop: 18, fontSize: 14 }}>
        {mode === "signup" ? (
          <>Already have an account? <a href={`/login?next=${encodeURIComponent(next)}`}>Log in</a></>
        ) : (
          <>New here? <a href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</a></>
        )}
      </p>
    </>
  );
}

