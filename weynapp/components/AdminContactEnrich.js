"use client";
import { useCallback, useEffect, useState } from "react";

// Drives the Google Places backfill in small chunks from the browser, so a
// 1,100-venue run is a series of short requests rather than one that outlives
// the serverless timeout.
export default function AdminContactEnrich() {
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [stop, setStop] = useState(false);
  const [progress, setProgress] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/enrich-contact");
    const body = await res.json();
    if (res.ok) setStats(body);
    else setNotice(body.error || "Could not read progress.");
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run() {
    setRunning(true);
    setStop(false);
    setNotice("");
    const totals = { updated: 0, noData: 0, errors: [] };

    try {
      // The query always reads the next unfilled rows, so each pass starts at
      // offset 0 — filled rows drop out of the set as they are written.
      for (let pass = 0; pass < 200; pass += 1) {
        if (stop) { setNotice("Stopped."); break; }
        const res = await fetch("/api/admin/enrich-contact", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ limit: 20, offset: 0 }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Lookup failed");

        totals.updated += body.updated || 0;
        totals.noData += body.noData || 0;
        if (body.errors?.length) totals.errors.push(...body.errors);
        setProgress({ ...totals });

        // Nothing attempted means the queue is empty; a batch of pure
        // no-data/errors would otherwise loop forever on the same rows.
        if (!body.attempted || (body.updated === 0 && body.attempted < 20)) break;
        if (body.updated === 0 && totals.noData > 200) break;
      }
      await load();
      setNotice(`Done. ${totals.updated} venues updated.`);
    } catch (e) {
      setNotice(e.message);
    }
    setRunning(false);
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <strong style={{ fontSize: 15 }}>Fill website, phone and hours from Google</strong>
      <p className="sub" style={{ marginTop: 6, fontSize: 13 }}>
        Looks up each venue by its Google Place ID and fills in the website, phone number and opening hours. Only touches
        venues that are still missing them, so re-running is cheap and never overwrites anything you have edited by hand.
      </p>
      {stats && (
        <p className="sub" style={{ marginTop: 6, fontSize: 13 }}>
          <strong>{stats.withWebsite}</strong> of {stats.total} venues have a website · <strong>{stats.remaining}</strong> still to look up
        </p>
      )}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button className="btn small" disabled={running || (stats && stats.remaining === 0)} onClick={run}>
          {running ? "Looking up…" : "Run backfill"}
        </button>
        {running && (
          <button className="btn small ghost" onClick={() => setStop(true)}>Stop</button>
        )}
      </div>
      {progress && (
        <div className="notice" style={{ marginTop: 10 }}>
          {progress.updated} updated · {progress.noData} had nothing to add
          {progress.errors.length > 0 && ` · ${progress.errors.length} errors`}
          {progress.errors.length > 0 && (
            <ul style={{ marginTop: 6, fontSize: 12 }}>
              {progress.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
      {notice && <div className="notice" style={{ marginTop: 10 }}>{notice}</div>}
    </div>
  );
}
