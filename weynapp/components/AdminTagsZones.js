"use client";
import { useState, useEffect, useCallback } from "react";

export default function AdminTagsZones() {
  const [sub, setSub] = useState("tags");
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [zones, setZones] = useState([]);
  const [newTag, setNewTag] = useState({ categoryId: "", displayName: "", subgroup: "" });
  const [newZone, setNewZone] = useState({ name: "", emirate: "Abu Dhabi" });
  const [busy, setBusy] = useState(false);

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/admin/tags");
    const d = await res.json();
    if (res.ok) { setCategories(d.categories || []); setTags(d.tags || []); }
  }, []);
  const loadZones = useCallback(async () => {
    const res = await fetch("/api/admin/zones");
    const d = await res.json();
    if (res.ok) setZones(d.zones || []);
  }, []);

  useEffect(() => { loadTags(); loadZones(); }, [loadTags, loadZones]);

  async function toggleTag(t) {
    setBusy(true);
    await fetch("/api/admin/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, patch: { is_active: !t.is_active } }),
    });
    setBusy(false);
    loadTags();
  }

  async function createTag() {
    if (!newTag.categoryId || !newTag.displayName.trim()) return;
    setBusy(true);
    await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTag),
    });
    setNewTag({ categoryId: "", displayName: "", subgroup: "" });
    setBusy(false);
    loadTags();
  }

  async function toggleZone(z) {
    setBusy(true);
    await fetch("/api/admin/zones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: z.id, patch: { is_active: !z.is_active } }),
    });
    setBusy(false);
    loadZones();
  }

  async function createZone() {
    if (!newZone.name.trim()) return;
    setBusy(true);
    await fetch("/api/admin/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newZone),
    });
    setNewZone({ name: "", emirate: newZone.emirate });
    setBusy(false);
    loadZones();
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={`chip ${sub === "tags" ? "sel" : ""}`} onClick={() => setSub("tags")}>Tags</button>
        <button className={`chip ${sub === "zones" ? "sel" : ""}`} onClick={() => setSub("zones")}>Zones</button>
      </div>

      {sub === "tags" && (
        <>
          <div className="card">
            <strong style={{ fontSize: 14 }}>Add a tag</strong>
            <div className="field">
              <label>Category</label>
              <select value={newTag.categoryId} onChange={(e) => setNewTag({ ...newTag, categoryId: e.target.value })}>
                <option value="">Choose…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Display name (emoji OK)</label>
              <input type="text" value={newTag.displayName} onChange={(e) => setNewTag({ ...newTag, displayName: e.target.value })} placeholder="🍹 Poolside" />
            </div>
            <div className="field">
              <label>Subgroup (optional)</label>
              <input type="text" value={newTag.subgroup} onChange={(e) => setNewTag({ ...newTag, subgroup: e.target.value })} placeholder="Evening Out" />
            </div>
            <button className="btn small" disabled={busy} onClick={createTag}>Add tag</button>
          </div>

          {categories.map((c) => (
            <div key={c.id} className="card">
              <div className="venue-name" style={{ fontSize: 15 }}>{c.name}</div>
              <div className="tag-row">
                {tags.filter((t) => t.category_id === c.id).map((t) => (
                  <button key={t.id} type="button" className={`chip ${t.is_active ? "sel" : ""}`} disabled={busy} onClick={() => toggleTag(t)} title={t.is_active ? "Click to deactivate" : "Click to activate"}>
                    {t.display_name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {sub === "zones" && (
        <>
          <div className="card">
            <strong style={{ fontSize: 14 }}>Add a zone</strong>
            <div className="field">
              <label>Name</label>
              <input type="text" value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} placeholder="Al Reem Island" />
            </div>
            <div className="field">
              <label>Emirate / City</label>
              <select value={newZone.emirate} onChange={(e) => setNewZone({ ...newZone, emirate: e.target.value })}>
                <option>Abu Dhabi</option>
                <option>Dubai</option>
              </select>
            </div>
            <button className="btn small" disabled={busy} onClick={createZone}>Add zone</button>
          </div>

          <div className="card">
            <div className="tag-row">
              {zones.map((z) => (
                <button key={z.id} type="button" className={`chip ${z.is_active ? "sel" : ""}`} disabled={busy} onClick={() => toggleZone(z)} title={z.is_active ? "Click to deactivate" : "Click to activate"}>
                  {z.name} ({z.emirate})
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
