"use client";
import { useCallback, useEffect, useState } from "react";

const blank = {
  id: null, title: "", description: "", city: "Dubai", neighborhood: "",
  category: "other", coverImageUrl: "", affiliateUrl: "", partner: "platinumlist",
  priceFromAed: "", ageRestriction: "all-ages", sortOrder: 0, isActive: true,
};

const CATEGORIES = [
  ["theme-park", "Theme park"],
  ["waterpark", "Waterpark"],
  ["desert-safari", "Desert safari"],
  ["landmark", "Landmark"],
  ["cruise", "Cruise"],
  ["tour", "Tour"],
  ["show", "Show"],
  ["museum", "Museum"],
  ["adventure", "Adventure"],
  ["other", "Other"],
];

export default function AdminAttractions() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/attractions");
    const body = await res.json();
    if (!res.ok) return setNotice(body.error || "Could not load attractions.");
    setItems(body.attractions || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function open(item = null) {
    setNotice("");
    setShowBulk(false);
    setEditing(item ? {
      id: item.id, title: item.title, description: item.description || "",
      city: item.city, neighborhood: item.neighborhood || "", category: item.category,
      coverImageUrl: item.cover_image_url || "", affiliateUrl: item.affiliate_url,
      partner: item.partner, priceFromAed: item.price_from_aed ?? "",
      ageRestriction: item.age_restriction, sortOrder: item.sort_order, isActive: item.is_active,
    } : { ...blank });
  }

  async function save() {
    setBusy(true); setNotice("");
    const res = await fetch("/api/admin/attractions", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editing),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setNotice(body.error || "Could not save.");
    setEditing(null); setNotice("Attraction saved."); await load();
  }

  // One per line: Title | https://affiliate-link | price | image-url
  async function saveBulk() {
    const rows = bulk.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [title, affiliateUrl, price, coverImageUrl] = line.split("|").map((p) => (p || "").trim());
      return { title, affiliateUrl, priceFromAed: price, coverImageUrl, partner: "platinumlist" };
    });
    if (!rows.length) return;
    setBusy(true); setNotice("");
    const res = await fetch("/api/admin/attractions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setNotice(body.error || "Could not add those.");
    setNotice(`Added ${body.inserted}.${body.errors?.length ? ` Skipped: ${body.errors.join("; ")}` : ""}`);
    setBulk(""); setShowBulk(false); await load();
  }

  async function remove(id) {
    if (!confirm("Delete this attraction?")) return;
    const res = await fetch("/api/admin/attractions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const body = await res.json();
    setNotice(res.ok ? "Deleted." : body.error || "Could not delete.");
    if (res.ok) await load();
  }

  const set = (patch) => setEditing((c) => ({ ...c, ...patch }));

  return (
    <section className="admin-editorial">
      <div className="admin-row">
        <div>
          <span className="eyebrow">Affiliate</span>
          <h2>Attractions &amp; tickets</h2>
          <p className="sub">
            Partner booking links (Platinumlist). These are kept separate from venues on purpose — they can never appear
            inside Find, Discover or three-pick results, and every card is labelled with the partner name.
          </p>
        </div>
        <div className="admin-actions">
          <button className="btn small ghost" type="button" onClick={() => { setShowBulk((v) => !v); setEditing(null); }}>
            Paste a batch
          </button>
          <button className="btn primary" type="button" onClick={() => open()}>New attraction</button>
        </div>
      </div>
      {notice && <div className="notice">{notice}</div>}

      {showBulk && (
        <div className="card editorial-editor">
          <h3>Paste a batch</h3>
          <p className="sub">
            One per line: <code>Title | https://affiliate-link | price | image-url</code>. Price and image are optional.
            Everything lands as Dubai / all-ages — edit individually afterwards.
          </p>
          <textarea
            rows={8}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Burj Khalifa At The Top | https://platinumlist.net/... | 169 | https://...jpg\nDesert Safari | https://platinumlist.net/... | 120"}
            style={{ width: "100%", marginTop: 8 }}
          />
          <button className="btn primary btn-full" disabled={busy || !bulk.trim()} onClick={saveBulk} style={{ marginTop: 10 }}>
            {busy ? "Adding..." : "Add all"}
          </button>
        </div>
      )}

      {editing && (
        <div className="card editorial-editor">
          <div className="admin-row">
            <h3>{editing.id ? "Edit attraction" : "New attraction"}</h3>
            <button className="btn small ghost" onClick={() => setEditing(null)}>Close</button>
          </div>

          <label className="field"><span>Title</span>
            <input type="text" maxLength={160} value={editing.title} onChange={(e) => set({ title: e.target.value })} placeholder="Burj Khalifa: At The Top" />
          </label>
          <label className="field"><span>Booking link (affiliate)</span>
            <input type="text" inputMode="url" value={editing.affiliateUrl} onChange={(e) => set({ affiliateUrl: e.target.value })} placeholder="https://platinumlist.net/..." />
          </label>
          <label className="field"><span>Description</span>
            <input type="text" maxLength={1000} value={editing.description} onChange={(e) => set({ description: e.target.value })} />
          </label>
          <label className="field"><span>Cover image link</span>
            <input type="text" inputMode="url" value={editing.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} placeholder="https://..." />
          </label>

          <div className="editorial-grid">
            <label className="field"><span>Category</span>
              <select value={editing.category} onChange={(e) => set({ category: e.target.value })}>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="field"><span>City</span>
              <select value={editing.city} onChange={(e) => set({ city: e.target.value })}>
                <option>Dubai</option><option>Abu Dhabi</option>
              </select>
            </label>
            <label className="field"><span>From (AED)</span>
              <input type="number" min="0" value={editing.priceFromAed} onChange={(e) => set({ priceFromAed: e.target.value })} />
            </label>
          </div>

          <div className="editorial-grid">
            <label className="field"><span>Age</span>
              <select value={editing.ageRestriction} onChange={(e) => set({ ageRestriction: e.target.value })}>
                <option value="all-ages">All ages</option>
                <option value="18-plus">18+</option>
                <option value="21-plus">21+</option>
              </select>
            </label>
            <label className="field"><span>Partner</span>
              <input type="text" value={editing.partner} onChange={(e) => set({ partner: e.target.value })} />
            </label>
            <label className="field"><span>Order</span>
              <input type="number" min="0" max="999" value={editing.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
            </label>
          </div>

          <label className="toggle-row">
            <input type="checkbox" checked={editing.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
            <span><strong>Published</strong><br /><small>Visible in the Attractions rail</small></span>
          </label>

          <button className="btn primary btn-full" disabled={busy || !editing.title.trim() || !editing.affiliateUrl.trim()} onClick={save}>
            {busy ? "Saving..." : "Save attraction"}
          </button>
        </div>
      )}

      <div className="editorial-list-admin">
        {items.length === 0 && <div className="discover-empty">Nothing yet. Add your first booking link.</div>}
        {items.map((item) => (
          <article className="card" key={item.id}>
            <div className="admin-row">
              <div>
                <span className={`saved-visibility ${item.is_active ? "public" : "private"}`}>
                  {item.is_active ? "live" : "draft"}
                </span>
                <h3>{item.title}</h3>
                <p className="sub">
                  {item.partner} · {item.city}
                  {item.price_from_aed ? ` · from ${item.price_from_aed} AED` : ""}
                  {" · order "}{item.sort_order}
                </p>
              </div>
              <div className="admin-actions">
                <button className="btn small" onClick={() => open(item)}>Edit</button>
                <button className="btn small ghost" onClick={() => remove(item.id)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
