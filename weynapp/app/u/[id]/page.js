import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { safeUrl } from "@/lib/sanitize";
import TagBadgeList from "@/components/TagBadgeList";

export const metadata = { title: "Profile, Weyn" };

export default async function PublicProfilePage({ params }) {
  const { id } = await params;
  const s = db();

  const [{ data: pub }, { data: allTags }] = await Promise.all([
    s.from("profile_public").select("id, display_name, avatar_url, bio, favorite_tags, ghost_mode").eq("id", id).single(),
    s.from("vibe_tags").select("slug, display_name, category_id, categories (name)").eq("is_active", true),
  ]);

  if (!pub) notFound();

  const tagMap = Object.fromEntries((allTags || []).map((t) => [t.slug, t]));
  const favoriteTags = (pub.favorite_tags || []).map((slug) => tagMap[slug]).filter(Boolean);
  const initials = (pub.display_name || "?").slice(0, 2).toUpperCase();
  const { data: posts } = pub.ghost_mode ? { data: [] } : await s.from("posts").select("id, body, photo_url, created_at, venues (name)").eq("user_id", id).eq("visibility", "public").order("created_at", { ascending: false }).limit(10);

  return (
    <>
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <Avatar className="h-16 w-16">
          <AvatarImage src={safeUrl(pub.avatar_url)} alt="" />
          <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <div className="venue-name">{pub.display_name || "Weyn user"}</div>
          {pub.bio && <p className="sub" style={{ marginBottom: 0, marginTop: 4 }}>{pub.bio}</p>}
        </div>
      </div>

      {favoriteTags.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 className="group-label">Favorite vibes</h2>
          <TagBadgeList tags={favoriteTags} />
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <h2 className="group-label">Public posts</h2>
        {pub.ghost_mode ? <p className="sub">This person has Ghost Mode on, so their activity is private.</p> : !posts?.length && <p className="sub">Nothing public yet.</p>}
        {posts?.map((p) => (
          <div className="card compact" key={p.id}>
            <div className="venue-meta" style={{ margin: 0 }}>
              at <strong>{p.venues?.name}</strong> · {new Date(p.created_at).toLocaleDateString()}
            </div>
            <p style={{ fontSize: 14, marginTop: 6 }}>{p.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}
