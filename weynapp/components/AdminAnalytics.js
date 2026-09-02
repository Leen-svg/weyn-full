"use client";
import { useEffect, useState } from "react";

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/analytics").then((response) => response.json().then((body) => ({ response, body }))).then(({ response, body }) => response.ok ? setData(body) : setError(body.error || "Could not load analytics."));
  }, []);
  if (error) return <div className="notice err">{error}</div>;
  if (!data) return <p className="sub">Loading analytics…</p>;
  const cards = [
    ["Total members", data.metrics.totalUsers], ["Joined today", data.metrics.newToday], ["New · 7 days", data.metrics.new7Days], ["New · 30 days", data.metrics.new30Days],
    ["Active · 30 days", data.metrics.active30Days], ["Saves · 30 days", data.metrics.saves30Days], ["Reviews · 30 days", data.metrics.reviews30Days], ["Check-ins · 30 days", data.metrics.checkIns30Days],
  ];
  const maxSignups = Math.max(1, ...data.daily.map((day) => day.signups));
  return <section className="admin-analytics">
    <div className="admin-row"><div><span className="eyebrow">Product analytics</span><h2>How Weyn is growing</h2><p className="sub">Member and engagement totals update from the live database.</p></div><a className="btn small" href={data.vercelAnalyticsUrl} target="_blank" rel="noopener noreferrer">Page views & custom events</a></div>
    <div className="analytics-metric-grid">{cards.map(([label, value]) => <div className="card analytics-metric" key={label}><strong>{Number(value).toLocaleString()}</strong><span>{label}</span></div>)}</div>
    <div className="analytics-grid">
      <div className="card"><h3>Daily signups</h3><div className="analytics-bars">{data.daily.map((day) => <div className="analytics-bar-row" key={day.date}><span>{new Date(`${day.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span><div><i style={{ width: `${Math.max(3, day.signups / maxSignups * 100)}%` }} /></div><strong>{day.signups}</strong></div>)}</div></div>
      <div className="card"><h3>Most engaged venues · 30 days</h3>{data.topVenues.length ? <ol className="analytics-top-list">{data.topVenues.map((venue) => <li key={venue.name}><span>{venue.name}</span><strong>{venue.interactions}</strong></li>)}</ol> : <p className="sub">No venue engagement yet.</p>}</div>
    </div>
  </section>;
}
