import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { safeUrl } from "@/lib/sanitize";
import ShareToGroupButton from "./ShareToGroupButton";
import ReportButton from "./ReportButton";

export default function PostCard({ post, isLoggedIn }) {
  const author = post.profile_public;
  const initials = (author?.display_name || "?").slice(0, 2).toUpperCase();
  const sharedList = post.saved_lists;

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
            <span style={{ color: "var(--ink-soft)" }}>{sharedList ? " shared " : " at "}</span>
            <strong>{sharedList?.title || post.venues?.name}</strong>
            {post.visibility === "friends" && <span className="tag-pill" style={{ marginLeft: 6 }}>👋 friends</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{new Date(post.created_at).toLocaleDateString()}</div>
          <p style={{ fontSize: 14, marginTop: 6 }}>{post.body}</p>
          {sharedList && <a className="post-list-preview" href={`/lists/${sharedList.share_slug}`}><span>Saved list</span><strong>{sharedList.title}</strong><small>{(sharedList.tags || []).map((tag) => `#${tag}`).join(" ") || "Open the collection"}</small></a>}
          {safeUrl(post.photo_url) && (
            <img
              src={safeUrl(post.photo_url)}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ marginTop: 8, width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 14 }}
            />
          )}
          {isLoggedIn && (
            <div style={{ marginTop: 8 }}>
              <ReportButton contentType="post" contentId={post.id} />
              <ShareToGroupButton text={sharedList ? `📚 ${author?.display_name || "Someone"} shared ${sharedList.title}: /lists/${sharedList.share_slug}` : `📣 ${author?.display_name || "Someone"} on ${post.venues?.name}: "${post.body}"`} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



