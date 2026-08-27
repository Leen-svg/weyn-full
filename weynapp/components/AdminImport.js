"use client";
import { useState } from "react";

const CHUNK_SIZE = 40;

function parseJsonlOrArray(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const emptySummary = () => ({ inserted: 0, updated: 0, skipped: 0, total: 0, errors: [], newTagsCreated: 0, mediaAdded: 0, mediaSkippedJunk: 0, mediaSkippedDuplicate: 0 });

export default function AdminImport() {
  const [file, setFile] = useState(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } or { stage: "wiping" }
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadVenues() {
    setDownloading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/export-venues");
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `weyn-venues-export-${new Date().toISOString().slice(0, 10)}.jsonl`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message);
    }
    setDownloading(false);
  }

  async function uploadCurationBatch(rows) {
    if (replaceAll) {
      const ok = window.confirm(
        `This deletes ALL live venues and replaces them with the ${rows.length} in this file. This can't be undone, download a backup first if you haven't. Continue?`
      );
      if (!ok) throw new Error("Cancelled, replace-all was not confirmed.");
      setProgress({ stage: "wiping" });
      const res = await fetch("/api/admin/replace-venues-start", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't clear existing venues");
    }

    const summary = emptySummary();
    summary.total = rows.length;
    const chunks = chunk(rows, CHUNK_SIZE);
    let done = 0;
    for (const c of chunks) {
      setProgress({ done, total: rows.length });
      const res = await fetch("/api/admin/import-venues-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: c }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Chunk import failed");
      summary.inserted += d.inserted;
      summary.updated += d.updated;
      summary.newTagsCreated += d.newTagsCreated;
      summary.mediaAdded += d.mediaAdded;
      summary.mediaSkippedJunk += d.mediaSkippedJunk;
      summary.mediaSkippedDuplicate += d.mediaSkippedDuplicate;
      summary.skipped += d.errors.length;
      summary.errors.push(...d.errors);
      done += c.length;
      setProgress({ done, total: rows.length });
    }
    return summary;
  }

  async function uploadRawBatch(rows) {
    if (replaceAll) {
      const ok = window.confirm(
        `This deletes ALL live venues and replaces them with the ${rows.length} in this file. Each one is enriched with AI-suggested tags (and a Google Places lookup for any missing coordinates) before import, so this is slower than a curated batch. This can't be undone, download a backup first if you haven't. Continue?`
      );
      if (!ok) throw new Error("Cancelled, replace-all was not confirmed.");
      setProgress({ stage: "wiping" });
      const res = await fetch("/api/admin/replace-venues-start", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't clear existing venues");
    }

    const summary = emptySummary();
    summary.total = rows.length;
    const chunks = chunk(rows, 20);
    let done = 0;
    for (const c of chunks) {
      setProgress({ done, total: rows.length });
      const res = await fetch("/api/admin/enrich-import-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: c }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Chunk enrich+import failed");
      summary.inserted += d.inserted;
      summary.updated += d.updated;
      summary.newTagsCreated += d.newTagsCreated;
      summary.mediaAdded += d.mediaAdded;
      summary.mediaSkippedJunk += d.mediaSkippedJunk;
      summary.mediaSkippedDuplicate += d.mediaSkippedDuplicate;
      summary.skipped += (d.errors?.length || 0) + (d.enrichErrors?.length || 0);
      summary.errors.push(...(d.errors || []), ...(d.enrichErrors || []));
      done += c.length;
      setProgress({ done, total: rows.length });
    }
    return summary;
  }

  async function uploadSimpleFile() {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/bulk-import", { method: "POST", body: form });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || "Import failed");
    return d;
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    setProgress(null);
    try {
      const lower = file.name.toLowerCase();
      let rows = null;
      if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson") || lower.endsWith(".json")) {
        try {
          rows = parseJsonlOrArray(await file.text());
        } catch {
          rows = null; // fall through to server-side parsing
        }
      }

      const isCurationBatch = Array.isArray(rows) && rows.length > 0 && rows[0]?.curation;
      const isRawScrapeBatch = Array.isArray(rows) && rows.length > 0 && !isCurationBatch && rows[0]?.id && rows[0]?.name;
      const summary = isCurationBatch
        ? await uploadCurationBatch(rows)
        : isRawScrapeBatch
          ? await uploadRawBatch(rows)
          : await uploadSimpleFile();
      setResult(summary);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
    setProgress(null);
  }

  return (
    <div className="card">
      <strong style={{ fontSize: 15 }}>Bulk import venues</strong>
      <p className="sub" style={{ marginTop: 6, fontSize: 13 }}>
        Drop a <code>.jsonl</code>, <code>.json</code>, <code>.csv</code>, or <code>.xlsx</code> file, no need to ask engineering
        to run it in first.
      </p>
      <p className="sub" style={{ marginTop: 4, fontSize: 13 }}>
        <strong>Scraper/tagging batch</strong> ({"{ venue_id, name, curation: {...}, metadata: {...} }"} per line): matched to an
        existing venue by Google Place ID (updates it) or added as new. Tags, price band, city/zone, and photos are all mapped
        automatically, new tag labels are registered on the fly, and junk or duplicate stock photos are skipped. Large files are
        uploaded in small batches automatically so nothing times out.
      </p>
      <p className="sub" style={{ marginTop: 4, fontSize: 13 }}>
        <strong>Raw Maps export</strong> ({"{ id, name, lat, lng, category, estimated_spend_aed, ... }"} per line, no <code>curation</code>
        key): matched by Google Place ID, run through AI tag enrichment automatically before import.
      </p>
      <p className="sub" style={{ marginTop: 4, fontSize: 13 }}>
        <strong>Simple spreadsheet</strong>: matched by name + neighborhood, or an <code>id</code> column that's an existing venue's
        database id (not a Google Place ID). Recognized columns: name,
        neighborhood, city (Abu Dhabi/Dubai), avg_spend_aed, google_maps_url, hero_video_url, menu_url, description, zone_slug, category,
        cuisine, age_restriction, is_aesthetic, latitude, longitude.
      </p>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--ink)" }}>
        <strong style={{ fontSize: 14 }}>Download current venues</strong>
        <p className="sub" style={{ marginTop: 4, fontSize: 13 }}>
          Exports every live venue as a <code>.jsonl</code> in the same scraper-batch format, fix issues in it and drop it right
          back in below to update those venues.
        </p>
        <button className="btn small ghost" style={{ marginTop: 8 }} disabled={downloading} onClick={downloadVenues}>
          {downloading ? "Preparing…" : "Download all venues (JSON)"}
        </button>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--ink)" }}>
        <input type="file" accept=".jsonl,.ndjson,.json,.csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label className="toggle-row" style={{ marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
          Replace all existing venues with this file (scraper-batch format only), deletes everything not in the file
        </label>
        <div style={{ marginTop: 10 }}>
          <button className="btn small" disabled={!file || busy} onClick={upload}>
            {busy
              ? progress?.stage === "wiping"
                ? "Clearing old venues…"
                : progress
                  ? `Importing… ${progress.done}/${progress.total}`
                  : "Importing…"
              : replaceAll
                ? "Replace all venues"
                : "Import"}
          </button>
        </div>
      </div>
      {err && <div className="notice err" style={{ marginTop: 10 }}>{err}</div>}
      {result && (
        <div className="notice" style={{ marginTop: 10 }}>
          {result.inserted} added · {result.updated} updated · {result.skipped} skipped (of {result.total})
          {typeof result.newTagsCreated === "number" && (
            <div style={{ marginTop: 4 }}>
              {result.newTagsCreated} new tag{result.newTagsCreated === 1 ? "" : "s"} registered · {result.mediaAdded} photos added
              {result.mediaSkippedJunk > 0 && ` · ${result.mediaSkippedJunk} junk photos skipped`}
              {result.mediaSkippedDuplicate > 0 && ` · ${result.mediaSkippedDuplicate} generic/duplicate photos skipped`}
            </div>
          )}
          {result.errors?.length > 0 && (
            <ul style={{ marginTop: 6, fontSize: 12 }}>
              {result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 20 && <li>…and {result.errors.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
