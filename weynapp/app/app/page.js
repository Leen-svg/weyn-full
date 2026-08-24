import Link from "next/link";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { withCovers } from "@/lib/venueMedia";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";
import HomeFeed from "@/components/HomeFeed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weyn, home" };

async function getHomeVenues() {
  const s = db();
  const [{ data: trending }, { data: fresh }] = await Promise.all([
    s
      .from("venues")
      .select("id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description")
      .eq("is_active", true)
      .eq("is_trending", true)
      .order("trending_rank", { ascending: true })
      .limit(7),
    s
      .from("venues")
      .select("id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const [trendingWithCovers, freshWithCovers] = await Promise.all([withCovers(trending || []), withCovers(fresh || [])]);
  return { trending: trendingWithCovers, fresh: freshWithCovers };
}

async function getCuratedLists() {
  const s = db();
  const { data: lists } = await s
    .from("curated_lists")
    .select("id, title, description")
    .eq("is_active", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (!lists?.length) return [];

  const { data: links } = await s
    .from("curated_list_venues")
    .select("list_id, position, venues (id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description)")
    .in("list_id", lists.map((list) => list.id))
    .order("position", { ascending: true });

  const venuesByList = {};
  for (const link of links || []) {
    if (link.venues) (venuesByList[link.list_id] ||= []).push(link.venues);
  }
  const withVenues = await Promise.all(
    lists.map(async (list) => ({ ...list, venues: await withCovers(venuesByList[list.id] || []) }))
  );
  return withVenues.filter((list) => list.venues.length > 0);
}

async function getInitialPublicPosts(supabase) {
  const { data } = await supabase
    .from("posts")
    .select("id, body, photo_url, visibility, created_at, user_id, venue_id, venues (id, name, neighborhood)")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(8);
  const posts = data || [];
  const authorIds = [...new Set(posts.map((post) => post.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profile_public")
        .select("id, display_name, avatar_url, ghost_mode")
        .in("id", authorIds)
        .eq("ghost_mode", false)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((author) => [author.id, author]));
  return posts
    .filter((post) => authorMap[post.user_id])
    .map((post) => ({ ...post, profile_public: authorMap[post.user_id] }));
}

export default async function HomePage() {
  const [{ trending, fresh }, supabase, curatedLists] = await Promise.all([getHomeVenues(), createClient(), getCuratedLists()]);
  const [{ data: { user } }, initialPosts] = await Promise.all([
    supabase.auth.getUser(),
    getInitialPublicPosts(supabase),
  ]);

  return (
    <div className="app-home">
      <header className="app-home__hero">
        <div>
          <h1>Discover</h1>
          <p className="sub">What&apos;s buzzing, what&apos;s new, and what your people are up to.</p>
        </div>
        <div className="cta-row">
          <Link className="btn primary" href="/find">
            Find a spot →
          </Link>
        </div>
      </header>

      {trending.length > 0 && (
        <section className="app-home__section app-home__picks" aria-label="Our picks">
          <div className="app-home__section-header">
            <div>
              <h2>Our picks</h2>
              <p>Worth leaving the group chat for.</p>
            </div>
            <span>Swipe →</span>
          </div>
          <div className="venue-rail" aria-label="Scroll through our picks">
            {trending.map((v) => (
              <VenueCard key={v.id} venue={v}>
                <VenueActions venue={v} />
              </VenueCard>
            ))}
          </div>
        </section>
      )}

      {curatedLists.map((list) => (
        <section className="app-home__section app-home__picks" aria-label={list.title} key={list.id}>
          <div className="app-home__section-header">
            <div>
              <h2>{list.title}</h2>
              {list.description && <p>{list.description}</p>}
            </div>
          </div>
          <div className="venue-rail" aria-label={`Scroll through ${list.title}`}>
            {list.venues.map((v) => (
              <VenueCard key={v.id} venue={v}>
                <VenueActions venue={v} />
              </VenueCard>
            ))}
          </div>
        </section>
      ))}

      <section className="app-home__feed" aria-label="Community feed">
        <div className="app-home__section-header app-home__feed-heading">
          <div>
            <h2>From the community</h2>
            <p>Fresh opinions from people who actually went.</p>
          </div>
        </div>
        <HomeFeed isLoggedIn={!!user} initialPosts={initialPosts} />
      </section>

      {fresh.length > 0 && (
        <section className="app-home__section">
          <div className="app-home__section-header">
            <h2 className="group-label">Just added</h2>
            <span>{fresh.length} spots</span>
          </div>
          <div className="venue-grid">
            {fresh.map((v) => (
              <VenueCard key={v.id} venue={v}>
                <VenueActions venue={v} />
              </VenueCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

