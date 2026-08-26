"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function removeAccount() {
    if (confirmation !== "DELETE") return;
    if (!window.confirm("This permanently deletes your Weyn account and everything tied to it. Continue?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn’t delete the account");
      await createClient().auth.signOut({ scope: "local" });
      window.location.assign("/");
    } catch (deleteError) {
      setError(deleteError.message || "Couldn’t delete the account");
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="danger-zone-title">
      <div>
        <h2 id="danger-zone-title">Delete account</h2>
        <p>This permanently removes your profile, lists, tags, plans, posts, reviews, groups you created, uploads, and account access.</p>
      </div>
      {!open ? (
        <button className="btn ghost danger" type="button" onClick={() => setOpen(true)}>Delete my account</button>
      ) : (
        <div className="danger-zone__confirm">
          <label className="field"><span>Type DELETE to confirm</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
          {error && <div className="notice err" role="alert">{error}</div>}
          <div>
            <button className="btn ghost" type="button" disabled={busy} onClick={() => { setOpen(false); setConfirmation(""); setError(""); }}>Cancel</button>
            <button className="btn danger" type="button" disabled={busy || confirmation !== "DELETE"} onClick={removeAccount}>{busy ? "Deleting…" : "Delete permanently"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
