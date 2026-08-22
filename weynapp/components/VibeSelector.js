"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
const NEARBY_RADIUS_KM = 15;
const CITY_CENTERS = [
  { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708 },
];

function distanceSquared(lat, lng, center) {
  const latitudeScale = Math.cos((lat * Math.PI) / 180);
  return (lat - center.lat) ** 2 + ((lng - center.lng) * latitudeScale) ** 2;
}

function nearestSupportedCity(lat, lng) {
  return CITY_CENTERS.reduce((nearest, center) =>
    distanceSquared(lat, lng, center) < distanceSquared(lat, lng, nearest) ? center : nearest
  ).name;
}

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
  const [shareGroups, setShareGroups] = useState(null);
  const [sharedGroupId, setSharedGroupId] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [openSections, setOpenSections] = useState(new Set());
  const [cold] = useState(isColdSeason);
  const [tagQuery, setTagQuery] = useState("");
  const [nearby, setNearby] = useState(null);
  const [locationState, setLocationState] = useState("idle");
  const [locationMessage, setLocationMessage] = useState("Suggestions anywhere in the selected city.");
  const sharePanelRef = useRef(null);

  useEffect(() => {
    if (!share) return;
    const timer = window.setTimeout(() => {
      sharePanelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "center",
      });
      sharePanelRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [share]);

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

  function toggleNearby() {
    if (locationState === "active") {
      setNearby(null);
      setLocationState("idle");
      setLocationMessage("Suggestions anywhere in the selected city.");
      setResults(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationState("error");
      setLocationMessage("Location is not supported by this browser. Choose a city or zone instead.");
      return;
    }

    setLocationState("loading");
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextNearby = {
          lat: coords.latitude,
          lng: coords.longitude,
          radiusKm: NEARBY_RADIUS_KM,
        };
        setNearby(nextNearby);
        setCity(nearestSupportedCity(coords.latitude, coords.longitude));
        setSelectedZones([]);
        setResults(null);
        setLocationState("active");
        setLocationMessage(`Near me is on, Weyn will only suggest mapped spots within ${NEARBY_RADIUS_KM} km.`);
      },
      (error) => {
        setNearby(null);
        setLocationState("error");
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage("Location access is blocked. Allow it in your browser settings, then try again.");
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage("Location took too long. Move somewhere with a clearer signal and retry.");
        } else {
          setLocationMessage("We couldn't find your location. Try again or choose a city or zone.");
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
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
          nearby,
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
      setSharedGroupId(null);
      if (isLoggedIn) {
        const groupsRes = await fetch("/api/groups");
        const groupsData = await groupsRes.json();
        setShareGroups(groupsRes.ok ? groupsData.groups || [] : []);
      } else {
        setShareGroups([]);
      }
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  async function shareWithGroup(groupId) {
    if (!share) return;
    setShareBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: `🗳️ Vote on where we should go: ${share}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not share with this group");
      setSharedGroupId(groupId);
    } catch (error) {
      setErr(error.message);
    } finally {
      setShareBusy(false);
    }
  }

  async function shareLink() {
    if (!share) return;
    if (navigator.share) {
      await navigator.share({ title: "Weyn, vote on where we're going", url: share }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(share);
    }
  }

  const zoneClusters = groupZonesByEmirate(zones);

  return (
    <div>
      <h2 className="group-label">Location</h2>
      <div className="details-card">
        <div className="details-row">
          <div>
            <strong>Keep suggestions close</strong>
            <p className="sub" style={{ margin: "4px 0 0", fontSize: 13 }}>
              Share your location only when you press the button.
            </p>
          </div>
          <button
            type="button"
            className={`btn small ${locationState === "active" ? "primary" : "ghost"}`}
            aria-pressed={locationState === "active"}
            disabled={locationState === "loading"}
            onClick={toggleNearby}
          >
            {locationState === "loading" ? "Locating…" : locationState === "active" ? "Near me on ✓" : "Near me"}
          </button>
        </div>
        <p
          className="sub"
          role={locationState === "error" ? "alert" : "status"}
          style={{
            margin: "12px 0 0",
            fontSize: 13,
            color: locationState === "error" ? "#c72f55" : undefined,
          }}
        >
          {locationMessage}
        </p>
      </div>

      <h2 className="group-label">City</h2>
      <div className="city-picker">
        {CITIES.map((c) => (
          <button key={c.value} type="button" className={`city-card ${city === c.value ? "sel" : ""}`} onClick={() => pickCity(c.value)}>
            <span className="city-card-name">{c.label}</span>
            <span className="city-card-note">{c.note}</span>
          </button>
        ))}
      </div>

      <div className="field" style={{ position: "relative", marginBottom: 20 }}>
        <Search
          className="h-4 w-4"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}
        />
        <input
          type="text"
          placeholder="Search tags, rooftop, date night, shisha…"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {groups.map((cat) => {
        const q = tagQuery.trim().toLowerCase();
        let visibleTags = cold ? cat.tags.filter((t) => !t.seasonal_exclude) : cat.tags;
        if (q) visibleTags = visibleTags.filter((t) => t.display_name.toLowerCase().includes(q));
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
              if (!cluster.subgroup || q) {
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
                <button className="btn primary block" disabled={loading} onClick={makePoll}>
                  Create a group vote
                </button>
                <p className="group-vote-hint">Then send it straight to one of your Weyn groups or share the link anywhere.</p>
              </div>
            </>
          )}
        </div>
      )}

      {share && (
        <div ref={sharePanelRef} tabIndex={-1} className="share-box poll-share-panel" role="region" aria-label="Share group vote">
          <div className="poll-share-heading">
            <span>Vote created ✓</span>
            <strong>Share with your Weyn groups</strong>
            <p>The poll stays live for 24 hours.</p>
          </div>
          {shareGroups === null && <p className="sub">Loading your recent groups…</p>}
          {shareGroups?.length > 0 && (
            <div className="recent-group-list">
              <span className="details-label">Recent groups</span>
              {shareGroups.slice(0, 5).map((group) => (
                <button
                  type="button"
                  className="recent-group-button"
                  key={group.id}
                  disabled={shareBusy}
                  onClick={() => shareWithGroup(group.id)}
                >
                  <span>
                    <b>{group.name}</b>
                    <small>{group.members.length} member{group.members.length === 1 ? "" : "s"}</small>
                  </span>
                  <span>{sharedGroupId === group.id ? "Sent ✓" : "Send →"}</span>
                </button>
              ))}
            </div>
          )}
          {isLoggedIn && shareGroups?.length === 0 && <p className="sub">No groups yet. You can still share the link anywhere.</p>}
          {!isLoggedIn && (
            <a className="recent-group-button poll-login-row" href="/login?next=/find">
              <span><b>Log in to share inside Weyn</b><small>Your recent groups will appear here.</small></span>
              <span>Log in →</span>
            </a>
          )}
          <div className="share-link-actions">
            <button className="btn small" type="button" onClick={shareLink}>Share anywhere</button>
            <button className="btn small ghost" type="button" onClick={() => navigator.clipboard?.writeText(share)}>Copy link</button>
          </div>
          <details>
            <summary>Show poll link</summary>
            <div className="link">{share}</div>
          </details>
        </div>
      )}
    </div>
  );
}



