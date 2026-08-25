"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "./PasswordInput";

const AUTH_ERRORS = {
  auth: "We couldn't complete sign-in. Please try again.",
  confirmation_failed:
    "This confirmation link is invalid or has expired. Please create your account again to receive a fresh link.",
};

export default function AuthForm({ mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, real users never see or fill this
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [betaAcknowledged, setBetaAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(() => AUTH_ERRORS[params.get("error")] || null);
  const [notice, setNotice] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (website) return; // bot filled the hidden field, silently drop
    if (mode === "signup" && (!termsAccepted || !privacyAccepted || !betaAcknowledged)) {
      setErr("Accept the Terms, Privacy Policy, and beta notice before creating an account.");
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: {
            terms_version: "2026-08-22",
            privacy_version: "2026-08-22",
            beta_acknowledged: true,
          },
        },
      });
      if (error) setErr(error.message);
      else if (data.session) {
        router.push(`/onboarding?next=${encodeURIComponent(next)}`);
        router.refresh();
      }
      else {
        setNotice("Check your email to confirm your account. Then you'll choose your unique username.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message);
      else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = user
          ? await supabase.from("profile_public").select("display_name").eq("id", user.id).maybeSingle()
          : { data: null };
        const hasUsername = /^[a-z0-9_]{3,24}$/.test(profile?.display_name || "");
        router.push(hasUsername ? next : `/onboarding?next=${encodeURIComponent(next)}`);
        router.refresh();
      }
    }
    setBusy(false);
  }

  async function google() {
    if (mode === "signup" && (!termsAccepted || !privacyAccepted || !betaAcknowledged)) {
      setErr("Accept the Terms, Privacy Policy, and beta notice before continuing with Google.");
      return;
    }
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
      <p className="eyebrow">{mode === "signup" ? "Create account" : "Log in"}</p>
      <h1>{mode === "signup" ? "Join weyn" : "Welcome back"}</h1>
      <p className="sub">
        {mode === "signup"
          ? "Invite-only beta. 18+. Features can change while we test."
          : "Pick up your spots, groups, and votes."}
      </p>

      <button className="btn ghost block" disabled={busy || (mode === "signup" && (!termsAccepted || !privacyAccepted || !betaAcknowledged))} onClick={google} type="button">
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

        {mode === "signup" && (
          <fieldset className="legal-consent">
            <legend>Required before signup</legend>
            <label>
              <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required />
              <span>I have read and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</span>
            </label>
            <label>
              <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} required />
              <span>I have read and accept the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>
            </label>
            <label>
              <input type="checkbox" checked={betaAcknowledged} onChange={(event) => setBetaAcknowledged(event.target.checked)} required />
              <span>I am 18 or older and understand Weyn is an experimental beta with features that may change, reset, or contain errors.</span>
            </label>
          </fieldset>
        )}
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

        <button className="btn primary block" disabled={busy || (mode === "signup" && (!termsAccepted || !privacyAccepted || !betaAcknowledged))} type="submit">
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


