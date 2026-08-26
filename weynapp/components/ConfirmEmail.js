"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MailCheck, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_SECONDS = 60;

// Webmail providers worth a one-tap shortcut. Anything else just gets the
// generic "check your inbox" copy — guessing a webmail URL for an unknown
// domain sends people somewhere broken.
const WEBMAIL = {
  "gmail.com": { label: "Open Gmail", url: "https://mail.google.com/mail/u/0/#search/from%3Aweyn" },
  "googlemail.com": { label: "Open Gmail", url: "https://mail.google.com/mail/u/0/#search/from%3Aweyn" },
  "outlook.com": { label: "Open Outlook", url: "https://outlook.live.com/mail/0/inbox" },
  "hotmail.com": { label: "Open Outlook", url: "https://outlook.live.com/mail/0/inbox" },
  "live.com": { label: "Open Outlook", url: "https://outlook.live.com/mail/0/inbox" },
  "yahoo.com": { label: "Open Yahoo Mail", url: "https://mail.yahoo.com/d/folders/1" },
  "icloud.com": { label: "Open iCloud Mail", url: "https://www.icloud.com/mail" },
  "me.com": { label: "Open iCloud Mail", url: "https://www.icloud.com/mail" },
};

export default function ConfirmEmail({ email, next = "/app", onUseDifferentEmail }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sentCount, setSentCount] = useState(0);
  const headingRef = useRef(null);

  // Move focus to the heading so screen-reader and keyboard users land on the
  // new screen instead of staying on the now-unmounted signup button.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const resend = useCallback(async () => {
    if (busy || secondsLeft > 0) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) setErr(error.message);
    else {
      setSentCount((n) => n + 1);
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    }
    setBusy(false);
  }, [busy, secondsLeft, email, next]);

  const domain = (email.split("@")[1] || "").toLowerCase();
  const webmail = WEBMAIL[domain];

  return (
    <section className="confirm-email" aria-labelledby="confirm-email-heading">
      <span className="confirm-email__icon" aria-hidden="true">
        <MailCheck />
      </span>

      <h1 id="confirm-email-heading" ref={headingRef} tabIndex={-1}>
        Check your inbox
      </h1>

      <p className="sub">
        We sent a confirmation link to{" "}
        <strong className="confirm-email__address">{email}</strong>. Open it and
        you&rsquo;ll come straight back to pick your username.
      </p>

      {webmail && (
        <a className="btn primary block" href={webmail.url} target="_blank" rel="noopener noreferrer">
          {webmail.label}
        </a>
      )}

      <button
        className="btn ghost block confirm-email__resend"
        type="button"
        onClick={resend}
        disabled={busy || secondsLeft > 0}
      >
        <RefreshCw aria-hidden="true" className={busy ? "spin" : undefined} />
        {busy
          ? "Sending…"
          : secondsLeft > 0
            ? `Resend in ${secondsLeft}s`
            : "Resend the email"}
      </button>

      {err && (
        <div className="notice err" role="alert">
          {err}
        </div>
      )}

      {sentCount > 0 && !err && (
        <div className="notice" role="status">
          Sent again. It can take a minute to arrive.
        </div>
      )}

      <p className="confirm-email__hint">
        Nothing yet? Check your spam or promotions folder — the link expires
        after 24 hours.
      </p>

      <p className="confirm-email__footer">
        Wrong address?{" "}
        <button type="button" className="linklike" onClick={onUseDifferentEmail}>
          Use a different one
        </button>
      </p>
    </section>
  );
}
