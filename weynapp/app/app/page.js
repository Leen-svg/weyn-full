import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentSession, viewerAccess } from "@/lib/session";
import { withCovers } from "@/lib/venueMedia";
import { getNightlife } from "@/lib/nightlife";
import { getUpcomingEvents, getAttractions } from "@/lib/homeRails";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";
import NightlifeSection from "@/components/NightlifeSection";
import { EventsSection, AttractionsSection } from "@/components/HomeRails";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";
import WelcomeHero from "@/components/WelcomeHero";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home" };

const VENUE_FIELDS = "id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, menu_url, is_aesthetic, age_restriction, description";

function editorialSection(list) {
  if (list.home_section === "our_picks" || list.home_section === "curated") return list.home_section;
  const label = `${list.slug || ""} ${list.title || ""}`.toLowerCase();
  return label.includes("our-picks") || label.includes("our picks") ? "our_picks" : "curated";
}

async function getDiscoverContent(allowedAges) {
  const s = db();
  const [trendingResult, freshResult, editorialWithSection] = await Promise.all([
    s
      .from("venues")
      .select(VENUE_FIELDS)
      .eq("is_active", true)
      .eq("is_trending", true)
      .in("age_restriction", allowedAges)
      .order("trending_rank", { ascending: true })
      .limit(6),
    s
      .from("venues")
      .select(VENUE_FIELDS)
      .eq("is_active", true)
      .in("age_restriction", allowedAges)
      .order("created_at", { ascending: false })
      .limit(9),
    s
      .from("editorial_lists")
      .select(`id, title, subtitle, slug, city, header_image_url, sort_order, home_section, editorial_list_items(position, venues(${VENUE_FIELDS}))`)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  // Deploy safely against databases where the optional section column has not
  // been migrated yet. Titles/slugs still provide a deterministic fallback.
  let editorialResult = editorialWithSection;
  if (editorialWithSection.error) {
    editorialResult = await s
      .from("editorial_lists")
      .select(`id, title, subtitle, slug, city, header_image_url, sort_order, editorial_list_items(position, venues(${VENUE_FIELDS}))`)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
  }

  const rawLists = editorialResult.data || [];
  const rawTrending = trendingResult.data || [];
  const rawFresh = freshResult.data || [];
  // Editorial venues arrive nested, so the age filter cannot be pushed into
  // the query the way it is for the flat lists above.
  const allowed = new Set(allowedAges);
  const rawEditorialVenues = rawLists.flatMap((list) =>
    [...(list.editorial_list_items || [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.venues)
      .filter((venue) => venue && allowed.has(venue.age_restriction))
  );
  const unique = new Map();
  for (const venue of [...rawTrending, ...rawFresh, ...rawEditorialVenues]) unique.set(venue.id, venue);
  const hydrated = await withCovers([...unique.values()], { maxMediaPerVenue: 3 });
  const venueById = new Map(hydrated.map((venue) => [venue.id, venue]));
  const resolve = (venues) => venues.map((venue) => venueById.get(venue.id) || venue);
  const editorialLists = rawLists.map((list) => ({
    ...list,
    home_section: editorialSection(list),
    description: list.subtitle || "",
    venues: [...(list.editorial_list_items || [])]
      .sort((a, b) => a.position - b.position)
      .map((item) => item.venues && allowed.has(item.venues.age_restriction) && venueById.get(item.venues.id))
      .filter(Boolean),
  })).filter((list) => list.venues.length > 0);

  return { trending: resolve(rawTrending), fresh: resolve(rawFresh), editorialLists };
}

export default async function HomePage() {
  const { user } = await currentSession();
  if (!user) return <WelcomeHero />;
  const access = await viewerAccess();
  // Accounts that predate the age gate have never answered it. Send them
  // through onboarding once rather than defaulting them into a tier silently.
  if (!access.hasAnsweredAge) redirect("/onboarding?next=%2Fapp");
  const [{ trending, fresh, editorialLists }, nightlife, events, attractions] = await Promise.all([
    getDiscoverContent(access.allowedAges),
    access.show21Plus ? getNightlife(access.allowedAges) : Promise.resolve(null),
    getUpcomingEvents(access.allowedAges),
    getAttractions(access.allowedAges),
  ]);
  const adminPicks = editorialLists
    .filter((list) => list.home_section === "our_picks")
    .flatMap((list) => list.venues)
    .filter((venue, index, venues) => venues.findIndex((candidate) => candidate.id === venue.id) === index)
    .slice(0, 8);
  const picks = adminPicks.length ? adminPicks : trending;
  const curatedLists = editorialLists.filter((list) => list.home_section === "curated");
  return (
    <div className="app-home">
      <section className="app-home__intro" aria-labelledby="home-title">
        <header className="app-home__hero">
          <div>
            <h1 id="home-title">Where to?</h1>
            <p className="sub">Tell Weyn the mood and the budget. Or just browse what everyone else is going to.</p>
          </div>
          <Link className="btn primary app-home__find-cta" href="/discover">
            Start browsing →
          </Link>
        </header>

        <div className="app-home__tools">
          <form className="discover-search" action="/find" method="get" role="search">
            <label className="sr-only" htmlFor="discover-search">Tell Weyn what kind of place you want</label>
            <span aria-hidden="true">⌕</span>
            <input id="discover-search" name="q" type="search" maxLength="120" autoComplete="off" placeholder="quiet rooftop date in Dubai…" />
            <button type="submit">Search</button>
          </form>

          <nav className="app-home__quick" aria-label="Quick ways to find a place">
            <Link className="app-home__quick-card" href="/plan">
              <strong>Magic Import</strong>
              <span>Paste a TikTok or chat</span>
            </Link>
            <Link className="app-home__quick-card" href="/find">
              <strong>Ask Weyn</strong>
              <span>A sentence. Three spots.</span>
            </Link>
          </nav>
        </div>
      </section>

      <EventsSection events={events} />
      <AttractionsSection attractions={attractions} />

      <section className="app-home__section app-home__picks" aria-label="Our picks">
        <div className="app-home__section-header">
          <div>
            <h2>Our picks</h2>
            <p>Worth leaving the group chat for.</p>
          </div>
          <Link className="app-home__section-action" href="/discover">See all</Link>
        </div>
        {picks.length ? (
          <div className="venue-rail" aria-label="Scroll through our picks">
            {picks.map((v) => (
              <VenueCard key={v.id} venue={v} variant="discover">
                <VenueActions venue={v} />
              </VenueCard>
            ))}
          </div>
        ) : <div className="discover-empty">Our next picks are being added now.</div>}
      </section>

      <section className="app-home__section app-home__curated" aria-labelledby="curated-title">
        <div className="app-home__section-header">
          <h2 id="curated-title">Curated</h2>
          {/* Discover shows these inline, which stops scaling past a handful.
              The browser at /collections holds all of them, with search. */}
          <Link className="app-home__section-action" href="/collections">
            Browse all
            {curatedLists.length ? <span aria-hidden="true"> · {curatedLists.length}</span> : null}
          </Link>
        </div>
        {curatedLists.length ? (
          <div className="curated-collection-grid">
            {curatedLists.map((list) => {
              const cover = normalizeHttpUrl(list.header_image_url) || normalizeHttpUrl(list.venues[0]?.cover_url);
              return (
                <details className="curated-collection" key={list.id}>
                  <summary style={cover ? { backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(12, 17, 25, .78)), url("${cover}")` } : undefined}>
                    <span>
                      <strong>{list.title}</strong>
                      {list.description && <small>{list.description}</small>}
                    </span>
                    <b aria-hidden="true">+</b>
                  </summary>
                  <div className="curated-collection__places">
                    <div className="venue-rail" aria-label={`Places in ${list.title}`}>
                      {list.venues.map((v) => (
                        <VenueCard key={v.id} venue={v} variant="discover">
                          <VenueActions venue={v} />
                        </VenueCard>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        ) : <div className="discover-empty">New collections are being prepared. Check back shortly.</div>}
      </section>

      {nightlife && <NightlifeSection {...nightlife} />}

      {fresh.length > 0 && (
        <section className="app-home__section">
          <div className="app-home__section-header">
            <h2>Just added</h2>
            <span>{fresh.length} spots</span>
          </div>
          <div className="venue-grid">
            {fresh.map((v) => (
              <VenueCard key={v.id} venue={v} variant="discover">
                <VenueActions venue={v} />
              </VenueCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
