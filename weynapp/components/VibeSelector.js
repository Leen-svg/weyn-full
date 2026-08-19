"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import VenueCard from "./VenueCard";
import VenueActions from "./VenueActions";

const BUDGETS = [
  { label: "Under 50 AED", value: 50 },
  { label: "Under 100", value: 100 },
  { label: "Under 150", value: 150 },
  { label: "Under 300", value: 300 },
  { label: "Whatever", value: 99999 },
];

const AGES = [
  { label: "All ages", value: "all-ages" },
  { label: "18+", value: "18-plus" },
  { label: "21+", value: "21-plus" },
];

const CITIES = [
  { value: "Abu Dhabi", label: "Abu Dhabi", note: "The full spread, updated weekly." },
  { value: "Dubai", label: "Dubai", note: "Just getting started, more added every week." },
];

const GUEST_TRIAL_LIMIT = 4;

function isColdSeason() {
  const m = new Date().getMonth() + 1; // 1-12
  const d = new Date().getDate();
  return m >= 11 || m <= 4 || (m === 10 && d >= 15);
}

function groupBySubgroup(tags) {
  const clusters = [];
  const bySubgroup = new Map();
  for (const t of tags) {
    const key = t.subgroup || null;
    if (!bySubgroup.has(key)) {
      const cluster = { subgroup: key, tags: [] };
      bySubgroup.set(key, cluster);
      clusters.push(cluster);
    }
    bySubgroup.get(key).tags.push(t);
  }
  return clusters;
}

function groupZonesByEmirate(zones) {
  const clusters = [];
  const byEmirate = new Map();
  for (const z of zones) {
    const key = z.emirate || "Other";
    if (!byEmirate.has(key)) {
      const cluster = { emirate: key, zones: [] };
      byEmirate.set(key, cluster);
      clusters.push(cluster);
    }
    byEmirate.get(key).zones.push(z);
  }
  return clusters;
}

function AccordionSection({ id, label, count, forceOpen, open, onToggle, children }) {
  const isOpen = forceOpen || open;
  return (
    <div className="accordion-section">
      <button type="button" className="accordion-header" onClick={() => onToggle(id)} aria-expanded={isOpen}>
        <span>{label}</span>
        <span className="accordion-meta">
          {count} <span className={`accordion-chevron ${isOpen ? "open" : ""}`}>›</span>
        </span>
      </button>
      {isOpen && <div className="accordion-body">{children}</div>}
    </div>
  );
}

export default function VibeSelector({ groups, zones = [], isLoggedIn = false }) {
  const router = useRouter();
  const [city, setCity] = useState("Abu Dhabi");
  const [selected, setSelected] = useState({});
  const [selectedZones, setSelectedZones] = useState([]);
  const [budget, setBudget] = useState(99999);
  const [maxAge, setMaxAge] = useState("all-ages");
  const [aesthetic, setAesthetic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [share, setShare] = useState(null);
  const [err, setErr] = useState(null);
  const [openSections, setOpenSections] = useState(new Set());
  const [cold] = useState(isColdSeason);

  function toggleSection(id) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickCity(c) {
    setCity(c);
    setSelectedZones([]);
    setResults(null);
  }

  function toggleZone(slug) {
    setSelectedZones((prev) => (prev.includes(slug) ? prev.filter((z) => z !== slug) : [...prev, slug]));
    setResults(null);
  }

  function toggleTag(cat, slug) {
    setSelected((prev) => {
      const cur = prev[cat.slug] || [];
      let next;
      if (cur.includes(slug)) next = cur.filter((s) => s !== slug);
      else if (cur.length >= cat.max_select) next = [...cur.slice(1), slug];
      else next = [...cur, slug];
      return { ...prev, [cat.slug]: next };
    });
    setResults(null); setShare(null);
  }

  const allTags = Object.values(selected).flat();
  const ready = allTags.length > 0;

  function guestAttemptsExhausted() {
    if (isLoggedIn) return false;
    const key = "weyn_guest_attempts";
    const used = parseInt(localStorage.getItem(key) || "0", 10);
    if (used >= GUEST_TRIAL_LIMIT) return true;
    localStorage.setItem(key, String(used + 1));
    return false;
  }

  async function getShortlist() {
    if (guestAttemptsExhausted()) {
      router.push("/signup?next=/find");
      return;
    }
    setLoading(true); setErr(null); setShare(null);
    try {
      const res = await fetch("/api/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: allTags, maxSpend: budget, aestheticOnly: aesthetic, maxAge, city,
          zones: selectedZones.length ? selectedZones : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResults(data.venues);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  async function makePoll() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: allTags, maxSpend: budget, aestheticOnly: aesthetic, maxAge,
          zones: null, venueIds: results.map((v) => v.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create poll");
      const url = `${window.location.origin}/p/${data.code}`;
      setShare(url);
      if (navigator.share) navigator.share({ title: "Weyn, vote on where we're going", url }).catch(() => {});
      else navigator.clipboard?.writeText(url).catch(() => {});
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  const zoneClusters = groupZonesByEmirate(zones);

  return (
    <div>
      <h2 className="group-label">City</h2>
      <div className="city-picker">
        {CITIES.map((c) => (
          <button key={c.value} type="button" className={`city-card ${city === c.value ? "sel" : ""}`} onClick={() => pickCity(c.value)}>
            <span className="city-card-name">{c.label}</span>
            <span className="city-card-note">{c.note}</span>
          </button>
        ))}
      </div>

      {groups.map((cat) => {
        const visibleTags = cold ? cat.tags.filter((t) => !t.seasonal_exclude) : cat.tags;
        if (visibleTags.length === 0) return null;
        const clusters = groupBySubgroup(visibleTags);
        return (
          <div key={cat.slug} className="tag-group-card">
            <h2 className="group-label" style={{ margin: "0 0 10px" }}>
              {cat.name} {cat.max_select > 1 ? `· pick up to ${cat.max_select}` : ""}
            </h2>
            {clusters.map((cluster) => {
              const id = `${cat.slug}::${cluster.subgroup || "_"}`;
              const picks = selected[cat.slug] || [];
              const hasSelection = cluster.tags.some((t) => picks.includes(t.slug));
              if (!cluster.subgroup) {
                return (
                  <div className="chips" key={id} style={{ marginBottom: 8 }}>
                    {cluster.tags.map((t) => (
                      <button key={t.slug} className={`chip ${picks.includes(t.slug) ? "sel" : ""}`} onClick={() => toggleTag(cat, t.slug)}>
                        {t.display_name}
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <AccordionSection
                  key={id}
                  id={id}
                  label={cluster.subgroup}
                  count={cluster.tags.length}
                  forceOpen={hasSelection}
                  open={openSections.has(id)}
                  onToggle={toggleSection}
                >
                  <div className="chips">
                    {cluster.tags.map((t) => (
                      <button key={t.slug} className={`chip ${picks.includes(t.slug) ? "sel" : ""}`} onClick={() => toggleTag(cat, t.slug)}>
                        {t.display_name}
                      </button>
                    ))}
                  </div>
                </AccordionSection>
              );
            })}
          </div>
        );
      })}

      {cold && (
        <p className="sub" style={{ marginTop: -8, marginBottom: 24, fontSize: 13 }}>
          🍂 It&apos;s outdoor off-season, hiding non-beach outdoor picks until May. Beach spots stay open year-round.
        </p>
      )}

      {zoneClusters.length > 0 && (
        <div className="tag-group-card">
          <h2 className="group-label" style={{ margin: "0 0 10px" }}>Zone (optional)</h2>
          {zoneClusters.length === 1 ? (
            <div className="chips">
              {zoneClusters[0].zones.map((z) => (
                <button key={z.slug} className={`chip ${selectedZones.includes(z.slug) ? "sel" : ""}`} onClick={() => toggleZone(z.slug)}>
                  {z.name}
                </button>
              ))}
            </div>
          ) : (
            zoneClusters.map((cluster) => {
              const id = `zone::${cluster.emirate}`;
              const hasSelection = cluster.zones.some((z) => selectedZones.includes(z.slug));
              return (
                <AccordionSection
                  key={id}
                  id={id}
                  label={cluster.emirate}
                  count={cluster.zones.length}
                  forceOpen={hasSelection}
                  open={openSections.has(id)}
                  onToggle={toggleSection}
                >
                  <div className="chips">
                    {cluster.zones.map((z) => (
                      <button key={z.slug} className={`chip ${selectedZones.includes(z.slug) ? "sel" : ""}`} onClick={() => toggleZone(z.slug)}>
                        {z.name}
                      </button>
                    ))}
                  </div>
                </AccordionSection>
              );
            })
          )}
        </div>
      )}

      <h2 className="group-label">Details</h2>
      <div className="details-card">
        <div className="details-row">
          <span className="details-label">Age</span>
          <div className="chips">
            {AGES.map((a) => (
              <button key={a.value} className={`chip ${maxAge === a.value ? "sel" : ""}`}
                onClick={() => { setMaxAge(a.value); setResults(null); }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="details-row">
          <span className="details-label">Budget</span>
          <div className="chips">
            {BUDGETS.map((b) => (
              <button key={b.value} className={`chip ${budget === b.value ? "sel" : ""}`}
                onClick={() => { setBudget(b.value); setResults(null); }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <label className="toggle-row" style={{ marginBottom: 0 }}>
          <input type="checkbox" checked={aesthetic} onChange={(e) => { setAesthetic(e.target.checked); setResults(null); }} />
          Aesthetic spots only 📸
        </label>
      </div>

      <div className="cta-row">
        <button className="btn primary block" disabled={!ready || loading} onClick={getShortlist}>
          {loading ? "Thinking…" : "Weyn? →"}
        </button>
      </div>

      {err && <div className="notice err">{err}</div>}

      {results && (
        <div style={{ marginTop: 34 }}>
          {results.length === 0 ? (
            <div className="notice err">
              Nothing matches that exact combo in {city} yet, try loosening the budget or picking fewer tags.
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: 18 }}>Your three, in {city}.</h2>
              <div className="venue-list-single">
                {results.map((v) => (
                  <VenueCard key={v.id} venue={v}>
                    <VenueActions venue={v} />
                  </VenueCard>
                ))}
              </div>
              <div className="cta-row">
                <button className="btn block" disabled={loading} onClick={makePoll}>
                  Make it a group vote 🔗
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {share && (
        <div className="share-box">
          <strong style={{ fontSize: 17 }}>Poll&apos;s live for 24 hours.</strong>
          <div className="link">{share}</div>
          <button className="btn small dark" onClick={() => navigator.clipboard.writeText(share)}>
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
