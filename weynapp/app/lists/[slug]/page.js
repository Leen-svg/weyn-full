import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import VenueCard from "@/components/VenueCard";
import { withCovers } from "@/lib/venueMedia";
import styles from "@/components/AccountPages.module.css";

export const metadata = { title: "Shared list", robots: { index: false, follow: false } };

export default async function SharedListPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const s = db();
  const { data: list } = await s.from("saved_lists").select("id, user_id, title, description, tags, visibility, archived_at, saved_list_items(venue_id, venues(*))").eq("share_slug", slug).maybeSingle();
  if (!list || list.archived_at) notFound();
  let allowed = list.visibility === "public" || user?.id === list.user_id;
  if (!allowed && user) {
    const [{ data: direct }, { data: groupShares }, { data: friendships }] = await Promise.all([
      s.from("saved_list_friend_shares").select("list_id").eq("list_id", list.id).eq("friend_id", user.id).maybeSingle(),
      s.from("saved_list_group_shares").select("group_id").eq("list_id", list.id),
      s.from("friendships").select("id").eq("status", "accepted").or(`and(requester_id.eq.${user.id},addressee_id.eq.${list.user_id}),and(requester_id.eq.${list.user_id},addressee_id.eq.${user.id})`).maybeSingle(),
    ]);
    allowed = !!direct || (list.visibility === "friends" && !!friendships);
    if (!allowed && groupShares?.length) {
      const { data: membership } = await s.from("friend_group_members").select("group_id").eq("user_id", user.id).in("group_id", groupShares.map((share) => share.group_id)).limit(1);
      allowed = !!membership?.length;
    }
  }
  if (!allowed) redirect(`/login?next=/lists/${encodeURIComponent(slug)}`);
  const venues = await withCovers((list.saved_list_items || []).map((item) => item.venues).filter(Boolean));
  return <div className={`${styles.pageWide} screen-collection-detail`}>
    <header className="screen-collection-detail__hero">
      <span className="eyebrow">Curated collection</span>
      <h1>{list.title}</h1>
      {list.description && <p className="sub">{list.description}</p>}
      {!!list.tags?.length && <div className="tag-row">{list.tags.map((tag) => <span className="tag-pill" key={tag}>#{tag}</span>)}</div>}
    </header>
    <div className="venue-list-single saved-shared-list">{venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)}</div>
  </div>;
}
