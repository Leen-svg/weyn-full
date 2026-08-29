"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Only rendered for viewers the server has already confirmed are 21+.
// The API re-checks anyway — this toggle cannot grant access on its own.
export default function AgePreference({ initial }) {
  const router = useRouter();
  const [on, setOn] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function toggle(next) {
    setBusy(true);
    setError(null);
    setOn(next);
    try {
      const res = await fetch("/api/account/age", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show21Plus: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that.");
      router.refresh();
    } catch (e) {
      setOn(!next);
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <label className="toggle-row">
        <input type="checkbox" checked={on} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        <span>
          <strong>Show 21+ places and nights</strong>
          <br />
          <small>Bars, lounges, clubs, beach clubs and 21+ events. Turn this off and they disappear everywhere in Weyn.</small>
        </span>
      </label>
      {error && <div className="notice err" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
