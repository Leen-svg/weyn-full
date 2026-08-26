"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

/* Keyword search across every published Weyn list.

   Matching runs over the list title, its description and the names,
   neighbourhoods and tags of the places inside it, so "sushi", "Yas Island"
   and "date night" all find the list that holds them even when the list title
   says none of those words. */
function haystack(list) {
  return [
    list.title,
    list.description,
    list.city,
    ...(list.venues || []).flatMap((v) => [v.name, v.neighborhood, v.city, ...(v.tags || [])]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function CuratedListsBrowser({ lists = [] }) {
  const [query, setQuery] = useState("");

  const indexed = useMemo(
    () => lists.map((list) => ({ ...list, _search: haystack(list) })),
    [lists],
  );

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length
    ? indexed.filter((list) => terms.every((t) => list._search.includes(t)))
    : indexed;

  return (
    <div className="curated-browser">
      <div className="curated-browser__search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search lists, places, areas or vibes…"
          aria-label="Search curated lists"
autoComplete="off"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <X aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="curated-browser__count" role="status">
        {terms.length
          ? `${results.length} of ${lists.length} list${lists.length === 1 ? "" : "s"}`
          : `${lists.length} list${lists.length === 1 ? "" : "s"}`}
      </p>

      {results.length === 0 ? (
        <div className="discover-empty">
          {lists.length === 0
            ? "New collections are being prepared. Check back shortly."
            : `Nothing matches “${query.trim()}”. Try a place, an area or a vibe.`}
        </div>
      ) : (
        <div className="curated-browser__grid">
          {results.map((list) => (
            <Link key={list.id} href={`/collections/${list.id}`} className="curated-browser__card">
              <span
                className="curated-browser__cover"
                style={list.coverUrl ? { backgroundImage: `url("${list.coverUrl}")` } : undefined}
                aria-hidden="true"
              />
              <span className="curated-browser__body">
                <strong>{list.title}</strong>
                {list.description && <small>{list.description}</small>}
                <em>
                  {list.venueCount} place{list.venueCount === 1 ? "" : "s"}
                  {list.city ? ` · ${list.city}` : ""}
                </em>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
