import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { canViewVisibility } from "@/lib/visibility.mjs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { safeUrl } from "@/lib/sanitize";
import TagBadgeList from "@/components/TagBadgeList";
import styles from "@/components/AccountPages.module.css";

export const metadata = { title: "Profile, Weyn" };

export default async function PublicProfilePage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const service = db();

  const [{ data: pub }, { data: preferences }, { data: allTags }] = await Promise.all([
    service.from("profile_public").select("id,display_name,avatar_url,bio,ghost_mode").eq("id", id).maybeSingle(),
    service.from("profile_favorite_preferences").select("favorite_tags,visibility").eq("user_id", id).maybeSingle(),
    service.from("vibe_tags").select("slug,display_name,category_id,categories(name)").eq("is_active", true),
  ]);
  if (!pub) notFound();

  let isFriend = false;
  if (user && user.id !== id && preferences?.visibility === "friends") {
    const { data: friendship } = await service.from("friendships").select("id").eq("status", "accepted")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
      .maybeSingle();
    isFriend = Boolean(friendship);
  }
  const canSeeFavorites = canViewVisibility({ viewerId: user?.id, ownerId: id, visibility: preferences?.visibility || "private", isFriend });
  const tagMap = Object.fromEntries((allTags || []).map((tag) => [tag.slug, tag]));
  const favoriteTags = canSeeFavorites ? (preferences?.favorite_tags || []).map((slug) => tagMap[slug]).filter(Boolean) : [];
  const initials = (pub.display_name || "?").slice(0, 2).toUpperCase();
  const { data: posts } = pub.ghost_mode ? { data: [] } : await service.from("posts")
    .select("id,body,photo_url,created_at,venues(name)")
    .eq("user_id", id)
    .eq("visibility", "public")
    .eq("status", "published")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className={`${styles.pageNarrow} screen-public-profile`}>
      <section className={styles.publicIdentity}>
        <Avatar className={styles.publicAvatar}>
          <AvatarImage src={safeUrl(pub.avatar_url)} alt="" />
          <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1>{pub.display_name || "Weyn user"}</h1>
          {pub.bio && <p>{pub.bio}</p>}
        </div>
      </section>

      {favoriteTags.length > 0 && (
        <section className={styles.publicSection}>
          <h2 className="group-label">Favorite vibes</h2>
          <TagBadgeList tags={favoriteTags} />
        </section>
      )}

      <section className={styles.publicSection}>
        <h2 className="group-label">Public posts</h2>
        {pub.ghost_mode ? <p className="sub">This person has Ghost Mode on, so their activity is private.</p> : !posts?.length && <p className="sub">Nothing public yet.</p>}
        {posts?.map((post) => (
          <article className={`card compact ${styles.publicPost}`} key={post.id}>
            <div className="venue-meta">at <strong>{post.venues?.name || "a shared collection"}</strong> · {new Date(post.created_at).toLocaleDateString()}</div>
            <p>{post.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
