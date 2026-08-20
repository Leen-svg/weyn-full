import Link from "next/link";
import { db } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { withCovers } from "@/lib/venueMedia";
import VenueCard from "@/components/VenueCard";
import HomeFeed from "@/components/HomeFeed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weyn, home" };

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
  const [trendingWithCovers, freshWithCovers] = await Promise.all([withCovers(trending || []), withCovers(fresh || [])]);
  return { trending: trendingWithCovers, fresh: freshWithCovers };
}

export default async function HomePage() {
  const [{ trending, fresh }, supabase] = await Promise.all([getHomeVenues(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

      <section className="app-home__feed" aria-label="Community feed">
        <HomeFeed isLoggedIn={!!user} />
      </section>

      {trending.length > 0 && (
        <section className="app-home__section">
          <div className="app-home__section-header">
            <h2 className="group-label">🔥 Trending this week</h2>
            <span>{trending.length} spots</span>
          </div>
          <div className="venue-grid">
            {trending.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="app-home__section">
          <div className="app-home__section-header">
            <h2 className="group-label">🆕 Just added</h2>
            <span>{fresh.length} spots</span>
          </div>
          <div className="venue-grid">
            {fresh.map((v) => (
              <VenueCard key={v.id} venue={v} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
