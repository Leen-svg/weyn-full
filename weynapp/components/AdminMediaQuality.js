"use client";

import { useMemo, useState } from "react";
import { readApiJson, splitIntoBatches } from "@/lib/admin-media-quality.mjs";
import { MEDIA_QUALITY_PRESETS, assessImageQuality } from "@/lib/media-quality.mjs";
import { safeUrl } from "@/lib/sanitize";

const SCAN_CONCURRENCY = 8;
const IMAGE_TIMEOUT_MS = 12_000;

function inspectImage(image) {
  return new Promise((resolve) => {
    const url = safeUrl(image.url);
    if (!url) {
      resolve({ ...image, loaded: false, width: 0, height: 0 });
      return;
    }

    const probe = new Image();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      probe.onload = null;
      probe.onerror = null;
      resolve({ ...image, ...result });
    };
    const timeout = setTimeout(() => finish({ loaded: false, width: 0, height: 0 }), IMAGE_TIMEOUT_MS);
    probe.onload = () => finish({ loaded: true, width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => finish({ loaded: false, width: 0, height: 0 });
    probe.src = url;
  });
}

async function inspectInBatches(images, onProgress) {
  const results = new Array(images.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < images.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await inspectImage(images[index]);
      completed += 1;
      onProgress(completed, images.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, images.length) }, () => worker()));
  return results;
}

function assessedImages(images, preset) {
  return images.map((image) => ({ ...image, quality: assessImageQuality(image, preset) }));
}

export default function AdminMediaQuality() {
  const [preset, setPreset] = useState("standard");
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState(false);

  const assessed = useMemo(() => assessedImages(images, preset), [images, preset]);
  const flagged = useMemo(() => assessed.filter((image) => image.quality.flagged), [assessed]);
  const selectedFlagged = flagged.filter((image) => selected.has(image.id));

  function selectPreset(nextPreset) {
    setPreset(nextPreset);
    const nextFlagged = assessedImages(images, nextPreset).filter((image) => image.quality.flagged);
    setSelected(new Set(nextFlagged.map((image) => image.id)));
  }

  async function scan() {
    setScanning(true);
    setError("");
    setStatus("Loading the image catalogue…");
    try {
      const response = await fetch("/api/admin/media-quality", { cache: "no-store" });
      const body = await readApiJson(response, "Could not load venue images");
      if (!body.images?.length) {
        setImages([]);
        setSelected(new Set());
        setStatus("There are no venue images to scan.");
        return;
      }

      const inspected = await inspectInBatches(body.images, (done, total) => setStatus(`Checking image ${done} of ${total}…`));
      const nextFlagged = assessedImages(inspected, preset).filter((image) => image.quality.flagged);
      setImages(inspected);
      setSelected(new Set(nextFlagged.map((image) => image.id)));
      setStatus(`Scanned ${inspected.length} images. ${nextFlagged.length} ${nextFlagged.length === 1 ? "was" : "were"} flagged.`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Image scan failed");
      setStatus("");
    } finally {
      setScanning(false);
    }
  }

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function removeSelected() {
    if (!selectedFlagged.length) return;
    const perVenue = new Map();
    for (const image of images) {
      const entry = perVenue.get(image.venueId) || { name: image.venueName, total: 0, removing: 0 };
      entry.total += 1;
      if (selected.has(image.id)) entry.removing += 1;
      perVenue.set(image.venueId, entry);
    }
    const emptied = [...perVenue.values()].filter((entry) => entry.total === entry.removing);
    const warning = emptied.length
      ? `\n\n${emptied.length} venue${emptied.length === 1 ? " will" : "s will"} have no images left.`
      : "";
    if (!window.confirm(`Permanently remove ${selectedFlagged.length} flagged image${selectedFlagged.length === 1 ? "" : "s"} from Weyn and storage?${warning}`)) return;

    setRemoving(true);
    setError("");
    const targetIds = selectedFlagged.map((image) => image.id);
    const batches = splitIntoBatches(targetIds);
    const processedIds = new Set();
    let removedCount = 0;
    let missingCount = 0;
    const storageWarnings = [];
    try {
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        setStatus(`Removing batch ${index + 1} of ${batches.length}…`);
        const response = await fetch("/api/admin/media-quality", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: batch }),
        });
        const body = await readApiJson(response, "Could not remove the selected images");
        batch.forEach((id) => processedIds.add(id));
        removedCount += body.removed || 0;
        missingCount += body.missing || 0;
        if (body.storageWarning) storageWarnings.push(body.storageWarning);

        const completedIds = new Set(processedIds);
        setImages((current) => current.filter((image) => !completedIds.has(image.id)));
        setSelected((current) => new Set([...current].filter((id) => !completedIds.has(id))));
      }

      const missingNote = missingCount ? ` ${missingCount} ${missingCount === 1 ? "was" : "were"} already missing.` : "";
      const storageNote = storageWarnings.length ? ` Storage warning: ${[...new Set(storageWarnings)].join("; ")}` : "";
      setStatus(`Removed ${removedCount} image${removedCount === 1 ? "" : "s"}.${missingNote}${storageNote}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Image removal failed");
      setStatus(processedIds.size
        ? `Removed ${removedCount} image${removedCount === 1 ? "" : "s"} before the error. The remaining images are still selected.`
        : "Removal stopped. No images were removed.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="quality-admin">
      <div className="card quality-admin-intro">
        <span className="eyebrow">Media cleanup</span>
        <h2>Find low-quality images</h2>
        <p>Weyn checks dimensions in your browser. Nothing is removed until you review the flagged thumbnails and confirm deletion.</p>
        <div className="quality-admin-controls">
          <label className="field quality-admin-preset">
            <span>Scan sensitivity</span>
            <select value={preset} onChange={(event) => selectPreset(event.target.value)} disabled={scanning || removing}>
              {Object.entries(MEDIA_QUALITY_PRESETS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn primary" onClick={scan} disabled={scanning || removing}>
            {scanning ? "Scanning…" : images.length ? "Scan again" : "Scan all venue images"}
          </button>
        </div>
        <p className="quality-admin-rule">{MEDIA_QUALITY_PRESETS[preset].description}</p>
      </div>

      {status && <div className="notice" role="status">{status}</div>}
      {error && <div className="notice err" role="alert">{error}</div>}

      {!!images.length && (
        <div className="quality-admin-summary">
          <div><strong>{images.length}</strong><span>scanned</span></div>
          <div><strong>{flagged.length}</strong><span>flagged</span></div>
          <div><strong>{selectedFlagged.length}</strong><span>selected</span></div>
        </div>
      )}

      {!!flagged.length && (
        <>
          <div className="quality-admin-actions">
            <button type="button" className="btn small ghost" onClick={() => setSelected(new Set(flagged.map((image) => image.id)))}>Select all flagged</button>
            <button type="button" className="btn small ghost" onClick={() => setSelected(new Set())}>Clear selection</button>
            <button type="button" className="btn small dark" onClick={removeSelected} disabled={removing || !selectedFlagged.length}>
              {removing ? "Removing…" : `Remove ${selectedFlagged.length || ""} flagged image${selectedFlagged.length === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="quality-media-grid">
            {flagged.map((image) => {
              const url = safeUrl(image.url);
              return (
                <label className={`quality-media-item ${selected.has(image.id) ? "selected" : ""}`} key={image.id}>
                  <input type="checkbox" checked={selected.has(image.id)} onChange={() => toggle(image.id)} />
                  <div className="quality-media-preview">
                    {url && image.loaded ? <img src={url} alt="" loading="lazy" /> : <span>Broken image</span>}
                  </div>
                  <div className="quality-media-copy">
                    <strong>{image.venueName}</strong>
                    <span>{image.loaded ? `${image.width} × ${image.height}` : "Unavailable"}</span>
                    <small>{image.quality.reasons.join(" · ")}</small>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}

      {!!images.length && !flagged.length && <div className="card quality-admin-clean"><strong>Everything passed.</strong><p>No low-quality venue images matched the selected sensitivity.</p></div>}
    </div>
  );
}
