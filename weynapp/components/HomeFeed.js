"use client";
import { useState, useCallback } from "react";
import PostComposer from "./PostComposer";
import PostCard from "./PostCard";

export default function HomeFeed({ isLoggedIn, initialPosts = [] }) {
  const [scope, setScope] = useState("public");
  const [posts, setPosts] = useState(initialPosts);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async (s) => {
    setPosts(null);
    const res = await fetch(`/api/posts?scope=${s}`);
    const d = await res.json();
    setPosts(res.ok ? d.posts || [] : []);
  }, []);

  function changeScope(nextScope) {
    if (nextScope === "friends" && !isLoggedIn) {
      window.location.href = "/signup?next=/app";
      return;
    }
    if (nextScope === scope) return;
    setScope(nextScope);
    load(nextScope);
  }

  return (
    <div className="home-feed">
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={`chip ${scope === "public" ? "sel" : ""}`} onClick={() => changeScope("public")}>
          🌍 Public
        </button>
        <button className={`chip ${scope === "friends" ? "sel" : ""}`} onClick={() => changeScope("friends")}>
          👋 Friends
        </button>
      </div>

      {isLoggedIn && (
        <PostComposer
          onPosted={(points) => {
            setMsg(points ? `Posted, +${points} points 📣` : "Posted.");
            load(scope);
          }}
        />
      )}
      {msg && <div className="notice" style={{ marginBottom: 16 }}>{msg}</div>}

      {posts === null && <p className="sub">Loading…</p>}
      {posts?.length === 0 && (
        <p className="sub">
          {scope === "friends" ? "No friend posts yet, add friends and check back." : "No posts yet, be the first to share a spot."}
        </p>
      )}
      {posts?.map((p) => <PostCard key={p.id} post={p} isLoggedIn={isLoggedIn} />)}
    </div>
  );
}

