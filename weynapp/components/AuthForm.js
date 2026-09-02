"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ConfirmEmail from "./ConfirmEmail";
import PasswordInput from "./PasswordInput";
import { trackProductEvent } from "@/lib/product-analytics";

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
  // Set when signup succeeds without a session, i.e. waiting on the emailed link.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(null);
  const consentReady = termsAccepted && privacyAccepted && betaAcknowledged;

  function recordSignup(user, source) {
    trackProductEvent("account_created", { method: source });
    if (user?.id) fetch("/api/auth/signup-notification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: user.id, source }) }).catch(() => {});
  }

  async function submit(e) {
    e.preventDefault();
    if (website) {
      setErr("Your browser autofilled a hidden field. Clear it and try again, or reload the page.");
      return;
    }
    if (mode === "signup" && !consentReady) {
      setErr("Accept the Terms, Privacy Policy, and beta notice before creating an account.");
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    const supabase = createClient();
    // Supabase surfaces transport failures as { error: { message: "Failed to
    // fetch" } }, which is not something to show a person.
    const readable = (message) =>
      !message || /failed to fetch|networkerror|load failed/i.test(message)
        ? "Couldn't reach the server. Check your connection and try again."
        : message;
    const guard = (work) =>
      Promise.race([
        work,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 20000)
        ),
      ]);

    // Every auth call here can THROW rather than resolve to { error } — a
    // dropped connection, a CORS failure, an SDK-level fault. Without this
    // guard the exception escaped the handler, the finally-less function never
    // cleared `busy`, and the button sat on "…" disabled forever showing no
    // message at all. Pressing "Create account" genuinely did nothing.
    try {
      if (mode === "signup") {
        const { data, error } = await guard(supabase.auth.signUp({
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
        }));
        if (error) setErr(readable(error.message));
        else if (data.session) {
          recordSignup(data.user, "email");
          router.push(`/onboarding?next=${encodeURIComponent(next)}`);
          router.refresh();
        } else {
          recordSignup(data.user, "email");
          setAwaitingConfirmation(email);
        }
      } else {
        const { error } = await guard(supabase.auth.signInWithPassword({ email, password }));
        if (error) setErr(readable(error.message));
        else {
          trackProductEvent("login_completed", { method: "email" });
          const { data: { user } } = await supabase.auth.getUser();
          const { data: profile } = user
            ? await supabase.from("profile_public").select("display_name").eq("id", user.id).maybeSingle()
            : { data: null };
          const hasUsername = /^[a-z0-9_]{3,24}$/.test(profile?.display_name || "");
          // A client push races the server components reading the auth cookie,
          // so the app re-rendered as a guest and bounced back to the welcome
          // screen. A full navigation guarantees the server sees the session.
          window.location.assign(hasUsername ? next : `/onboarding?next=${encodeURIComponent(next)}`);
          return;
        }
      }
    } catch (cause) {
      setErr(
        cause?.message === "timeout"
          ? "That took too long. Check your connection and try again."
          : cause?.message?.includes("fetch") || cause?.name === "TypeError"
            ? "Couldn't reach the server. Check your connection and try again."
            : cause?.message || "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (mode === "signup" && !consentReady) {
      setErr("Accept the Terms, Privacy Policy, and beta notice before continuing with Google.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    try {
      trackProductEvent(mode === "signup" ? "signup_started" : "login_started", { method: "google" });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        setErr(error.message);
        setBusy(false);
      }
      // On success the browser navigates away, so `busy` is left set on purpose.
    } catch (cause) {
      setErr(cause?.message || "Couldn't start Google sign-in. Please try again.");
      setBusy(false);
    }
  }

  if (awaitingConfirmation) {
    return (
      <ConfirmEmail
        email={awaitingConfirmation}
        next={next}
        onUseDifferentEmail={() => {
          setAwaitingConfirmation(null);
          setPassword("");
          setErr(null);
        }}
      />
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-heading">
        <p className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</p>
        <h1>{mode === "signup" ? "Join Weyn" : "Log in"}</h1>
      </div>
      <p className="sub">
        {mode === "signup"
          ? "One account for your saved places, groups, and votes across Abu Dhabi and Dubai."
          : "Pick up your saved places, groups, and plans."}
      </p>

      {mode === "signup" && (
        <fieldset className="legal-consent auth-consent">
          <legend>Before you continue</legend>
          <p>Confirm these once, then choose Google or email.</p>
          <label>
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</span>
          </label>
          <label>
            <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
            <span>I accept the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span>
          </label>
          <label>
            <input type="checkbox" checked={betaAcknowledged} onChange={(event) => setBetaAcknowledged(event.target.checked)} />
            <span>I am 18 or older and understand Weyn is currently in beta.</span>
          </label>
        </fieldset>
      )}

      <button className="btn google btn-full" disabled={busy || (mode === "signup" && !consentReady)} onClick={google} type="button">
        <svg className="google-logo" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
          <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.844 2.078-1.797 2.716v2.258h2.909c1.702-1.566 2.684-3.874 2.684-6.614Z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.91-2.259c-.805.54-1.835.859-3.046.859-2.344 0-4.328-1.584-5.037-3.711H.956v2.332A9 9 0 0 0 9 18Z" />
          <path fill="#FBBC05" d="M3.963 10.709A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.709V4.959H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.041l3.007-2.332Z" />
          <path fill="#EA4335" d="M9 3.58c1.322 0 2.508.455 3.441 1.346l2.581-2.581C13.464.891 11.43 0 9 0A9 9 0 0 0 .956 4.959l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58Z" />
        </svg>
        Continue with Google
      </button>

      <div className="or-divider"><span>or</span></div>

      <form onSubmit={submit}>
        <input
          type="text"
          name="weyn-ref-code"
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

        {err && <div className="notice err" role="alert">{err}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}

        <button className="btn primary btn-full" disabled={busy || (mode === "signup" && !consentReady)} type="submit">
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
    </div>
  );
}
