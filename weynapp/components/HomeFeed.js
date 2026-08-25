"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import PostCard from "./PostCard";

const PostComposer = dynamic(() => import("./PostComposer"), {
  loading: () => <div className="home-skeleton__line" aria-hidden="true" />,
});

const SCOPES = [
  { id: "public", label: "Public" },
  { id: "friends", label: "Friends" },
];

export default function HomeFeed({ isLoggedIn, initialPosts = [] }) {
  const reduced = useReducedMotion();
  const [scope, setScope] = useState("public");
  const [posts, setPosts] = useState(initialPosts);
  const [msg, setMsg] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const load = useCallback(async (nextScope) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPosts(null);

    try {
      const res = await fetch(`/api/posts?scope=${nextScope}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await res.json();
      if (!controller.signal.aborted) setPosts(res.ok ? data.posts || [] : []);
    } catch (error) {
      if (error.name !== "AbortError") setPosts([]);
    }
  }, []);

  function changeScope(nextScope) {
    if (nextScope === "friends" && !isLoggedIn) {
      window.location.assign("/signup?next=/app");
      return;
    }
    if (nextScope === scope) return;
    setScope(nextScope);
    load(nextScope);
  }

  return (
    <div className="home-feed">
      {/* Segmented control, not two loose chips. Public and Friends are
          two views of one feed, so they share a track and a single
          indicator slides between them (layoutId does the travel). */}
      <div className="segmented" role="group" aria-label="Community feed filter">
        <LayoutGroup id="feed-scope">
          {SCOPES.map(({ id, label }) => {
            const active = scope === id;
            return (
              <button
                key={id}
                type="button"
                className={active ? "segmented__option active" : "segmented__option"}
                onClick={() => changeScope(id)}
                aria-pressed={active}
              >
                {active && (
                  <motion.span
                    layoutId="feed-scope-thumb"
                    className="segmented__thumb"
                    aria-hidden="true"
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 520, damping: 38, mass: 0.7 }
                    }
                  />
                )}
                <span className="segmented__label">{label}</span>
              </button>
            );
          })}
        </LayoutGroup>
      </div>

      {isLoggedIn && (
        <PostComposer
          onPosted={(points) => {
            setMsg(points ? `Posted, +${points} points` : "Posted.");
            load(scope);
          }}
        />
      )}
      {msg && <div className="notice" style={{ marginBottom: 16 }} role="status">{msg}</div>}

      {posts === null && <p className="sub" role="status">Loading…</p>}
      {posts?.length === 0 && (
        <p className="sub">
          {scope === "friends" ? "No friend posts yet. Add friends and check back." : "No posts yet. Be the first to share a spot."}
        </p>
      )}
      {posts?.map((post) => <PostCard key={post.id} post={post} isLoggedIn={isLoggedIn} />)}
    </div>
  );
}
