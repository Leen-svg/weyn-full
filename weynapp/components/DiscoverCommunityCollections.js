"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const EMPTY = { lists: [], tags: [] };

export default function DiscoverCommunityCollections({ isLoggedIn = false }) {
  const [scope, setScope] = useState("public");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState("");
  const requestRef = useRef(null);

  useEffect(() => {
    if (scope === "friends" && !isLoggedIn) {
      setResults(EMPTY);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setError("");
      setResults(null);
      try {
        const response = await fetch(`/api/discover/community?scope=${scope}&q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Couldn’t load community collections");
        if (!controller.signal.aborted) setResults({ lists: body.lists || [], tags: body.tags || [] });
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setResults(EMPTY);
          setError(loadError.message || "Couldn’t load community collections");
        }
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [scope, query, isLoggedIn]);

  async function addToSaved(type, id) {
    if (!isLoggedIn) {
      window.location.assign("/login?next=/app");
      return;
    }
    const key = `${type}:${id}`;
    setBusyKey(key);
    setError("");
    try {
      const response = await fetch("/api/discover/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn’t add that collection");
      setSaved((current) => new Set(current).add(key));
    } catch (saveError) {
      setError(saveError.message || "Couldn’t add that collection");
    } finally {
      setBusyKey("");
    }
  }

  const collections = [
    ...(results?.lists || []).map((item) => ({ ...item, type: "list", label: item.title, href: `/lists/${item.share_slug}` })),
    ...(results?.tags || []).map((item) => ({ ...item, type: "tag", label: `#${item.name}`, href: `/tags/${item.share_slug}` })),
  ];

  return (
    <section className="community-collections" aria-labelledby="community-collections-title">
      <div className="app-home__section-header community-collections__heading">
        <div>
          <h2 id="community-collections-title">Lists &amp; tags</h2>
          <p>Search collections made public by the community or shared by friends.</p>
        </div>
      </div>

      <div className="community-collections__controls">
        <div className="community-segmented" role="tablist" aria-label="Collection audience">
          <button type="button" role="tab" aria-selected={scope === "public"} className={scope === "public" ? "active" : ""} onClick={() => setScope("public")}>Public</button>
          <button type="button" role="tab" aria-selected={scope === "friends"} className={scope === "friends" ? "active" : ""} onClick={() => setScope("friends")}>Friends</button>
        </div>
        <label className="community-collections__search">
          <span className="sr-only">Search community lists and tags</span>
          <b aria-hidden="true">⌕</b>
          <input type="search" value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="Search lists and personal tags" autoComplete="off" />
        </label>
      </div>

      {error && <div className="notice err" role="alert">{error}</div>}
      {scope === "friends" && !isLoggedIn && <div className="discover-empty"><Link href="/login?next=/app">Log in</Link> to see collections shared by friends.</div>}
      {results === null && isLoggedIn && <div className="community-collections__loading" role="status">Loading collections…</div>}
      {results && collections.length === 0 && <div className="discover-empty">{query.trim() ? "No matching collections yet." : scope === "friends" ? "Your friends haven’t shared any collections yet." : "Public community collections will appear here."}</div>}

      {!!collections.length && (
        <div className="community-collection-grid">
          {collections.map((item) => {
            const key = `${item.type}:${item.id}`;
            const isSaved = saved.has(key);
            return (
              <article className="community-collection-card" key={key}>
                <div className="community-collection-card__meta">
                  <span>{item.type === "tag" ? "Personal tag" : "Saved list"}</span>
                  <span>{item.visibility}</span>
                </div>
                <Link href={item.href} className="community-collection-card__body">
                  <h3>{item.label}</h3>
                  {item.description && <p>{item.description}</p>}
                  <small>{item.place_count || 0} place{item.place_count === 1 ? "" : "s"} · by {item.author?.display_name || "Weyn member"}</small>
                </Link>
                <div className="community-collection-card__actions">
                  <Link href={item.href}>Open</Link>
                  <button type="button" disabled={isSaved || busyKey === key} onClick={() => addToSaved(item.type, item.id)}>{isSaved ? "Added ✓" : busyKey === key ? "Adding…" : "Add to Saved"}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
