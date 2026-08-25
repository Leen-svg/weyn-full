import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { withCovers } from "@/lib/venueMedia";
import { withRatings } from "@/lib/venueRatings";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";
import { safeUrl } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

/* Detail page for a "Curated by Weyn" collection.

   curated_lists previously had no page of its own: the home screen
   rendered every list inline as its own rail, so a list could be seen
   but never linked to. The collection tiles on Discover need a
   destination, so this is it. Nothing was taken away, the same venues
   are still reachable, they just have an address now.

   Note this is NOT /lists/[slug]: that route serves saved_lists, the
   lists individual users build and share. Different table, different
   permissions. */

async function getCollection(id) {
  const s = db();
  const { data: list } = await s
    .from("curated_lists")
    .select("id, title, description")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!list) return null;

  const { data: links } = await s
    .from("curated_list_venues")
    .select(
      "position, venues (id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, is_aesthetic, age_restriction, description)"
    )
    .eq("list_id", list.id)
    .order("position", { ascending: true });

  const venues = (links || []).map((link) => link.venues).filter(Boolean);
  return { ...list, venues: await withRatings(await withCovers(venues)) };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const list = await getCollection(id);
  return {
    title: list ? list.title : "Collection",
    description: list?.description || undefined,
    robots: { index: false, follow: false },
  };
}

export default async function CollectionPage({ params }) {
  const { id } = await params;
  const list = await getCollection(id);
  if (!list) notFound();

  const cover = safeUrl(list.venues[0]?.cover_url);

  return (
    <div className="collection-page">
      <header className="collection-hero">
        {cover && <img className="collection-hero__bg" src={cover} alt="" aria-hidden="true" />}
        <div className="collection-hero__body">
          <Link className="collection-hero__back" href="/app">
            ← Discover
          </Link>
          <span className="eyebrow">Curated by Weyn</span>
          <h1>{list.title}</h1>
          {list.description && <p className="sub">{list.description}</p>}
          <span className="collection-hero__count">
            {list.venues.length} {list.venues.length === 1 ? "spot" : "spots"}
          </span>
        </div>
      </header>

      {list.venues.length > 0 ? (
        <div className="venue-list-single">
          {list.venues.map((venue, index) => (
            <VenueCard key={venue.id} venue={venue} priority={index === 0}>
              <VenueActions venue={venue} />
            </VenueCard>
          ))}
        </div>
      ) : (
        <p className="sub">This collection is empty for now.</p>
      )}
    </div>
  );
}
