"use client";

import { useEffect, useState } from "react";

// Same notice as the static marketing pages (public/site.css + public/site.js),
// so the bar looks and behaves identically whichever side of the site you land on.
export default function CookieBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("weyn_ck") !== "1") setShow(true);
    } catch {
      // private mode, just don't nag
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem("weyn_ck", "1");
    } catch {}
  }

  return (
    <div id="ckbar" className="on" role="region" aria-label="Cookie notice">
      <p>
        We don&apos;t run tracking or advertising cookies. Weyn keeps one cookie so you stay logged in.{" "}
        <a href="/privacy">More in our privacy page</a>.
      </p>
      <button type="button" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
