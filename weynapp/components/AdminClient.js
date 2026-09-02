"use client";
import { useState, useEffect, useCallback } from "react";
import VenueEditor from "./VenueEditor";
import AdminUsers from "./AdminUsers";
import AdminTagsZones from "./AdminTagsZones";
import AdminImport from "./AdminImport";
import AdminEditorialLists from "./AdminEditorialLists";
import AdminEvents from "./AdminEvents";
import AdminAttractions from "./AdminAttractions";
import AdminMediaQuality from "./AdminMediaQuality";
import AdminAnalytics from "./AdminAnalytics";
import { safeUrl } from "@/lib/sanitize";

export default function AdminClient() {
  const [tab, setTab] = useState("submissions");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/queues");
    const d = await res.json();
    if (!res.ok) { setErr(d.error); return; }
    setData(d); setErr(null);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(kind, id, action) {
    setBusy(true);
    const res = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, action }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error);
    await load();
    setBusy(false);
  }

  if (!data) return <p className="sub">Loading…</p>;

  const tabs = [
    ["analytics", "Analytics", 0],
    ["submissions", "New spots", data.submissions.length],
    ["content", "Content reports", data.contentReports.length],
    ["photos", "Photo review", data.pendingMedia.length],
    ["tags", "Tag disputes", data.disputes.reduce((n, d) => n + d.issues.length, 0)],
    ["videos", "Videos", data.videos.length],
    ["takedowns", "Takedowns", data.takedowns.length],
    ["venues", "Venues", 0],
    ["media-quality", "Image quality", 0],
    ["editorial", "Weyn lists", 0],
    ["events", "Events", 0],
    ["attractions", "Attractions", 0],
    ["import", "Bulk import", 0],
    ["taxonomy", "Tags & zones", 0],
    ["users", "Users", 0],
  ];

  return (
    <>
      <h1>Admin</h1>
      <p className="sub">{data.venueCount} live venues</p>

      <div className="admin-tabs">
        {tabs.map(([key, label, count]) => (
          <button key={key} className={`chip ${tab === key ? "sel" : ""}`} onClick={() => setTab(key)}>
            {label}{count > 0 && <span className="count-badge">{count}</span>}
          </button>
        ))}
      </div>

      {err && <div className="notice err">{err}</div>}

      {tab === "submissions" && (
        data.submissions.length === 0 ? <p className="sub">Nothing pending 🎉</p> :
        data.submissions.map((s) => (
          <div className="card" key={s.id}>
            <div className="admin-row">
              <div>
                <div className="venue-name">{s.name}</div>
                <div className="venue-meta">{s.zone_slug} · {s.neighborhood || ", "} · {s.avg_spend_aed ?? "?"} AED</div>
                <div className="tag-row">
                  {[s.energy_tag, ...(s.activity_tags || []), ...(s.occasion_tags || [])].filter(Boolean)
                    .map((t) => <span className="tag-pill" key={t}>{t}</span>)}
                </div>
                {s.why_love && <p style={{ fontSize: 14, margin: "8px 0" }}>&ldquo;{s.why_love}&rdquo;</p>}
                <div className="mono">
                  {s.submitter_name || "anon"} {s.submitter_handle ? `· @${s.submitter_handle}` : ""}
                  {safeUrl(s.google_maps_url) ? <> · <a href={safeUrl(s.google_maps_url)} target="_blank" rel="noreferrer">maps</a></> : null}
                </div>
              </div>
              <div className="admin-actions">
                <button className="btn small" disabled={busy} onClick={() => act("submission", s.id, "approve")}>Approve</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("submission", s.id, "duplicate")}>Dupe</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("submission", s.id, "reject")}>Reject</button>
              </div>
            </div>
          </div>
        ))
      )}

      {tab === "content" && (
        data.contentReports.length === 0 ? <p className="sub">No open content reports.</p> :
        data.contentReports.map((item) => (
          <div className="card" key={item.key}>
            <div className="admin-row">
              <div>
                <div className="venue-name">{item.count} report{item.count === 1 ? "" : "s"} · {item.contentType}</div>
                <div className="venue-meta">{item.content?.venues?.name || "Unknown place"} · {item.content?.status || "missing"}</div>
                <p style={{ fontSize: 14, margin: "8px 0" }}>{item.content?.body || "(No text)"}</p>
                <div className="mono">Reasons: {item.reasons.join(", ")}</div>
              </div>
              <div className="admin-actions">
                <button className="btn small" disabled={busy} onClick={() => act("content", item.key, "restore")}>Keep / restore</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("content", item.key, "remove")}>Remove</button>
              </div>
            </div>
          </div>
        ))
      )}

      {tab === "photos" && (
        data.pendingMedia.length === 0 ? <p className="sub">No photos waiting for review.</p> :
        data.pendingMedia.map((item) => (
          <div className="card" key={item.id}>
            <div className="admin-row">
              <div>
                {safeUrl(item.preview_url) && <img src={safeUrl(item.preview_url)} alt="User-submitted photo awaiting moderation" style={{ width: 220, maxWidth: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 12 }} />}
                <div className="venue-name">{item.venues?.name || item.context_type}</div>
                <div className="venue-meta">{item.visibility} · {Math.ceil(item.byte_size / 1024)} KB · {item.mime_type}</div>
              </div>
              <div className="admin-actions">
                <button className="btn small" disabled={busy} onClick={() => act("media", item.id, "approve")}>Approve</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("media", item.id, "reject")}>Reject</button>
              </div>
            </div>
          </div>
        ))
      )}

      {tab === "tags" && (
        data.disputes.length === 0 ? <p className="sub">No tag feedback yet.</p> :
        data.disputes.map((d) => (
          <div className="card" key={d.venue_id}>
            <div className="venue-name">{d.name}</div>
            <div className="venue-meta">{d.fits} said tags fit · {d.issues.length} flagged an issue</div>
            {d.issues.map((v) => (
              <div className="admin-row" key={v.id} style={{ borderTop: "1px solid var(--ink)", paddingTop: 10, marginTop: 10 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>
                    {v.vote === "wrong_tag" ? `✋ "${v.tag_slug}" doesn't belong` : `➕ should have "${v.suggested_tag_slug}"`}
                  </strong>
                  {v.comment && <div className="mono">&ldquo;{v.comment}&rdquo;</div>}
                </div>
                <div className="admin-actions">
                  <button className="btn small" disabled={busy} onClick={() => act("tagvote", v.id, "apply")}>Apply</button>
                  <button className="btn small ghost" disabled={busy} onClick={() => act("tagvote", v.id, "dismiss")}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {tab === "videos" && (
        data.videos.length === 0 ? <p className="sub">No videos waiting.</p> :
        data.videos.map((v) => (
          <div className="card" key={v.id}>
            <div className="admin-row">
              <div>
                <div className="venue-name">{v.venues?.name || v.venue_name_free}</div>
                <div className="venue-meta">
                  @{v.creator_handle}
                  {v.status === "takedown_requested" && <strong style={{ color: "var(--accent)" }}> · TAKEDOWN REQUESTED</strong>}
                </div>
                {safeUrl(v.tiktok_url) && <a className="mono" href={safeUrl(v.tiktok_url)} target="_blank" rel="noreferrer">{v.tiktok_url}</a>}
                {v.contact_email && <div className="mono">{v.contact_email}</div>}
                {!v.venue_id && <div className="notice err" style={{ margin: "8px 0", padding: 8, fontSize: 13 }}>Venue not in DB, add it first</div>}
              </div>
              <div className="admin-actions">
                <button className="btn small" disabled={busy || !v.venue_id} onClick={() => act("video", v.id, "approve")}>Feature</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("video", v.id, "remove")}>Remove</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("video", v.id, "reject")}>Reject</button>
              </div>
            </div>
          </div>
        ))
      )}

      {tab === "takedowns" && (
        data.takedowns.length === 0 ? <p className="sub">No takedown requests.</p> :
        data.takedowns.map((t) => (
          <div className="card" key={t.id}>
            <div className="admin-row">
              <div>
                <div className="venue-name">@{t.creator_handle}</div>
                {safeUrl(t.video_url) && <a className="mono" href={safeUrl(t.video_url)} target="_blank" rel="noreferrer">{t.video_url}</a>}
                {t.reason && <p style={{ fontSize: 14, margin: "8px 0" }}>&ldquo;{t.reason}&rdquo;</p>}
                {t.contact_email && <div className="mono">{t.contact_email}</div>}
              </div>
              <div className="admin-actions">
                <button className="btn small" disabled={busy} onClick={() => act("takedown", t.id, "complete")}>Remove video</button>
                <button className="btn small ghost" disabled={busy} onClick={() => act("takedown", t.id, "reject")}>Reject</button>
              </div>
            </div>
          </div>
        ))
      )}

      {tab === "venues" && <VenueEditor />}
      {tab === "analytics" && <AdminAnalytics />}
      {tab === "media-quality" && <AdminMediaQuality />}
      {tab === "editorial" && <AdminEditorialLists />}
      {tab === "events" && <AdminEvents />}
      {tab === "attractions" && <AdminAttractions />}
      {tab === "import" && <AdminImport />}
      {tab === "taxonomy" && <AdminTagsZones />}
      {tab === "users" && <AdminUsers />}
    </>
  );
}
