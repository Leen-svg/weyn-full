"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import PostCard from "./PostCard";

const PostComposer = dynamic(() => import("./PostComposer"), {
  loading: () => <div className="home-skeleton__line" aria-hidden="true" />,
});

export default function HomeFeed({ isLoggedIn, initialPosts = [] }) {
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
      <div className="chips" style={{ marginBottom: 16 }} role="group" aria-label="Community feed filter">
        <button type="button" className={`chip ${scope === "public" ? "sel" : ""}`} onClick={() => changeScope("public")} aria-pressed={scope === "public"}>
          Public
        </button>
        <button type="button" className={`chip ${scope === "friends" ? "sel" : ""}`} onClick={() => changeScope("friends")} aria-pressed={scope === "friends"}>
          Friends
        </button>
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
