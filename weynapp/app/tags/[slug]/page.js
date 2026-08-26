import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { canViewVisibility } from "@/lib/visibility.mjs";
import { withCovers } from "@/lib/venueMedia";
import VenueCard from "@/components/VenueCard";

export const metadata = { title: "Community tag", robots: { index: false, follow: false } };

export default async function CommunityTagPage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const service = db();
  const { data: tag } = await service.from("user_tags").select("id,user_id,name,description,visibility,archived_at,user_tag_venues(venues(*))").eq("share_slug", slug).maybeSingle();
  if (!tag || tag.archived_at) notFound();
  let isFriend = false;
  if (user && user.id !== tag.user_id && tag.visibility === "friends") {
    const { data: friendship } = await service.from("friendships").select("id").eq("status", "accepted").or(`and(requester_id.eq.${user.id},addressee_id.eq.${tag.user_id}),and(requester_id.eq.${tag.user_id},addressee_id.eq.${user.id})`).maybeSingle();
    isFriend = Boolean(friendship);
  }
  if (!canViewVisibility({ viewerId: user?.id, ownerId: tag.user_id, visibility: tag.visibility, isFriend })) redirect(`/login?next=/tags/${encodeURIComponent(slug)}`);
  const venues = await withCovers((tag.user_tag_venues || []).map((item) => item.venues).filter(Boolean));
  return <div className="screen-collection-detail">
    <header className="screen-collection-detail__hero">
      <span className="eyebrow">Community tag · {tag.visibility}</span>
      <h1>#{tag.name}</h1>
      {tag.description && <p className="sub">{tag.description}</p>}
    </header>
    <div className="venue-list-single saved-shared-list">{venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)}</div>
  </div>;
}

