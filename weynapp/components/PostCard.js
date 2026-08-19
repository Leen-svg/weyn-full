import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { safeUrl } from "@/lib/sanitize";
import ShareToGroupButton from "./ShareToGroupButton";

export default function PostCard({ post, isLoggedIn }) {
  const author = post.profile_public;
  const initials = (author?.display_name || "?").slice(0, 2).toUpperCase();

  return (
    <div className="card compact">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Avatar className="h-9 w-9">
          <AvatarImage src={safeUrl(author?.avatar_url)} alt="" />
          <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14 }}>
            <strong>{author?.display_name || "Someone"}</strong>
            <span style={{ color: "var(--ink-soft)" }}> at </span>
            <strong>{post.venues?.name}</strong>
            {post.visibility === "friends" && <span className="tag-pill" style={{ marginLeft: 6 }}>👋 friends</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{new Date(post.created_at).toLocaleDateString()}</div>
          <p style={{ fontSize: 14, marginTop: 6 }}>{post.body}</p>
          {safeUrl(post.photo_url) && (
            <img
              src={safeUrl(post.photo_url)}
              alt=""
              style={{ marginTop: 8, width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, border: "2px solid var(--ink)" }}
            />
          )}
          {isLoggedIn && (
            <div style={{ marginTop: 8 }}>
              <ShareToGroupButton text={`📣 ${author?.display_name || "Someone"} on ${post.venues?.name}: "${post.body}"`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
