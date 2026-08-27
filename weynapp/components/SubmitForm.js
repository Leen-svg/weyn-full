"use client";
import { useState } from "react";

export default function SubmitForm({ groups, zones }) {
  const [form, setForm] = useState({
    name: "", zone_slug: "", neighborhood: "", google_maps_url: "",
    why_love: "", avg_spend_aed: "", submitter_name: "", submitter_handle: "",
  });
  const [tags, setTags] = useState({});
  const [state, setState] = useState({ busy: false, done: false, err: null });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function toggleTag(cat, slug) {
    setTags((prev) => {
      const cur = prev[cat.slug] || [];
      let next;
      if (cur.includes(slug)) next = cur.filter((s) => s !== slug);
      else if (cur.length >= cat.max_select) next = [...cur.slice(1), slug];
      else next = [...cur, slug];
      return { ...prev, [cat.slug]: next };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, done: false, err: null });
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tagsByCategory: tags }),
    });
    const d = await res.json();
    if (!res.ok) setState({ busy: false, done: false, err: d.error });
    else {
      setState({ busy: false, done: true, err: null });
      setForm({ name: "", zone_slug: "", neighborhood: "", google_maps_url: "", why_love: "", avg_spend_aed: "", submitter_name: form.submitter_name, submitter_handle: form.submitter_handle });
      setTags({});
    }
  }

  if (state.done) {
    return (
      <div>
        <div className="notice">
          Got it, thank you 🙏 We&apos;ll review it and add it if it fits the vibe.
        </div>
        <button className="btn ghost" onClick={() => setState({ busy: false, done: false, err: null })}>
          Add another spot
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="propose-form">
      <div className="field">
        <label htmlFor="sf-name">Place name *</label>
        <input id="sf-name" type="text" required maxLength={120} value={form.name} onChange={set("name")} placeholder="e.g. Nightjar Coffee Roasters" />
      </div>

      <div className="field">
        <label htmlFor="sf-zone">Zone *</label>
        <select id="sf-zone" required value={form.zone_slug} onChange={set("zone_slug")}>
          <option value="">Pick a zone…</option>
          {zones.map((z) => <option key={z.slug} value={z.slug}>{z.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="sf-hood">Neighborhood <span className="hint">(e.g. Alserkal Avenue)</span></label>
        <input id="sf-hood" type="text" maxLength={80} value={form.neighborhood} onChange={set("neighborhood")} />
      </div>

      <div className="field">
        <label htmlFor="sf-maps">Google Maps link <span className="hint">(helps us find it fast)</span></label>
        <input id="sf-maps" type="url" value={form.google_maps_url} onChange={set("google_maps_url")} placeholder="https://maps.google.com/…" />
      </div>

      <div className="field">
        <label htmlFor="sf-spend">Roughly how much per person? <span className="hint">in AED</span></label>
        <input id="sf-spend" type="number" min="0" max="5000" value={form.avg_spend_aed} onChange={set("avg_spend_aed")} placeholder="60" />
      </div>

      {groups.map((cat) => (
        <div key={cat.slug}>
          <h2 className="group-label">{cat.name} {cat.max_select > 1 ? `· up to ${cat.max_select}` : ""}</h2>
          <div className="chips">
            {cat.tags.map((t) => (
              <button type="button" key={t.slug}
                className={`chip ${(tags[cat.slug] || []).includes(t.slug) ? "sel" : ""}`}
                onClick={() => toggleTag(cat, t.slug)}>
                {t.display_name}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="field" style={{ marginTop: 22 }}>
        <label htmlFor="sf-why">Why do you love it? <span className="hint">one or two lines</span></label>
        <textarea id="sf-why" maxLength={400} value={form.why_love} onChange={set("why_love")} placeholder="Tiny courtyard, best karak in the city, never crowded before 6pm…" />
      </div>

      <div className="field">
        <label htmlFor="sf-yourname">Your name <span className="hint">(optional)</span></label>
        <input id="sf-yourname" type="text" maxLength={40} value={form.submitter_name} onChange={set("submitter_name")} />
      </div>

      <div className="field">
        <label htmlFor="sf-handle">Your Instagram / TikTok handle <span className="hint">(optional, we credit you)</span></label>
        <input id="sf-handle" type="text" maxLength={40} value={form.submitter_handle} onChange={set("submitter_handle")} placeholder="@yourhandle" />
      </div>

      {state.err && <div className="notice err">{state.err}</div>}

      <div className="cta-row">
        <button className="btn btn-full" type="submit" disabled={state.busy}>
          {state.busy ? "Sending…" : "Submit spot"}
        </button>
      </div>
    </form>
  );
}
