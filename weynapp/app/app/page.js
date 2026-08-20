import Link from "next/link";
import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { withCovers } from "@/lib/venueMedia";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";
import HomeFeed from "@/components/HomeFeed";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Discover",
  description: "See Weyn's latest Abu Dhabi picks and fresh community recommendations.",
};

async function getHomeVenues() {
  const s = db();
  const [{ data: trending }, { data: fresh }] = await Promise.all([
    s
      .from("venues")
      .select("id, name, neighborhood, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description")
      .eq("is_active", true)
      .eq("is_trending", true)
      .order("trending_rank", { ascending: true })
      .limit(7),
    s
      .from("venues")
      .select("id, name, neighborhood, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const unique = [...new Map([...(trending || []), ...(fresh || [])].map((venue) => [venue.id, venue])).values()];
  const enriched = await withCovers(unique);
  const byId = new Map(enriched.map((venue) => [venue.id, venue]));
  return {
    trending: (trending || []).map((venue) => byId.get(venue.id) || venue),
    fresh: (fresh || []).map((venue) => byId.get(venue.id) || venue),
  };
}

const getCachedHomeVenues = unstable_cache(getHomeVenues, ["weyn-home-venues-v2"], {
  revalidate: 300,
  tags: ["home-venues"],
});

async function getInitialPublicPosts(supabase) {
  const { data } = await supabase
    .from("posts")
    .select("id, body, photo_url, visibility, created_at, user_id, venue_id, venues (id, name, neighborhood)")
    .eq("visibility", "public")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(8);
  const posts = data || [];
  const authorIds = [...new Set(posts.map((post) => post.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profile_public").select("id, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors || []).map((author) => [author.id, author]));
  return posts.map((post) => ({ ...post, profile_public: authorMap[post.user_id] || null }));
}

function SectionSkeleton({ cards = false }) {
  return (
    <div className="home-skeleton" aria-hidden="true">
      <div className="home-skeleton__heading" />
      <div className={cards ? "home-skeleton__card" : "home-skeleton__line"} />
    </div>
  );
}

async function VenueSections() {
  const { trending, fresh } = await getCachedHomeVenues();

  return (
    <>
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
            {trending.map((venue, index) => (
              <VenueCard key={venue.id} venue={venue} priority={index === 0}>
                <VenueActions venue={venue} />
              </VenueCard>
            ))}
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="app-home__section">
          <div className="app-home__section-header">
            <h2 className="group-label">Just added</h2>
            <span>{fresh.length} spots</span>
          </div>
          <div className="venue-grid">
            {fresh.map((venue) => (
              <VenueCard key={venue.id} venue={venue}>
                <VenueActions venue={venue} />
              </VenueCard>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

async function CommunitySection() {
  const supabase = await createClient();
  const [{ data: { user } }, initialPosts] = await Promise.all([
    supabase.auth.getUser(),
    getInitialPublicPosts(supabase),
  ]);

  return (
    <section className="app-home__feed" aria-label="Community feed">
      <div className="app-home__section-header app-home__feed-heading">
        <div>
          <h2>From the community</h2>
          <p>Fresh opinions from people who actually went.</p>
        </div>
      </div>
      <HomeFeed isLoggedIn={!!user} initialPosts={initialPosts} />
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="app-home">
      <header className="app-home__hero">
        <div>
          <span className="eyebrow">Abu Dhabi, curated</span>
          <h1>Find the plan. Skip the spiral.</h1>
          <p className="sub">Three thoughtful picks, one quick group vote, and you're out the door.</p>
        </div>
        <div className="cta-row">
          <Link className="btn primary" href="/find">
            Find a spot <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <Suspense fallback={<SectionSkeleton cards />}>
        <VenueSections />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <CommunitySection />
      </Suspense>
    </div>
  );
}

