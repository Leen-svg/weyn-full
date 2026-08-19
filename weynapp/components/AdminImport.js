"use client";
import { useState } from "react";

export default function AdminImport() {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/admin/bulk-import", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      setResult(d);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <strong style={{ fontSize: 15 }}>Bulk import venues</strong>
      <p className="sub" style={{ marginTop: 6, fontSize: 13 }}>
        Drop a <code>.jsonl</code>, <code>.json</code>, <code>.csv</code>, or <code>.xlsx</code> file. Each row/object should have
        at least <code>name</code>; matching rows (by name + neighborhood, or an <code>id</code> column) update the existing
        venue, everything else is added as new. Recognized columns: name, neighborhood, city (Abu Dhabi/Dubai), avg_spend_aed,
        google_maps_url, hero_video_url, description, zone_slug, category, cuisine, age_restriction, is_aesthetic, latitude, longitude.
      </p>
      <input type="file" accept=".jsonl,.ndjson,.json,.csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginTop: 10 }} />
      <div style={{ marginTop: 10 }}>
        <button className="btn small" disabled={!file || busy} onClick={upload}>
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      {err && <div className="notice err" style={{ marginTop: 10 }}>{err}</div>}
      {result && (
        <div className="notice" style={{ marginTop: 10 }}>
          {result.inserted} added · {result.updated} updated · {result.skipped} skipped (of {result.total})
          {result.errors?.length > 0 && (
            <ul style={{ marginTop: 6, fontSize: 12 }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
