import Link from "next/link";
import { db } from "@/lib/db";
import { withCovers } from "@/lib/venueMedia";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";

export const dynamic = "force-dynamic";

const VENUE_FIELDS = "id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, menu_url, is_aesthetic, age_restriction, description";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadVenue(id) {
  if (!UUID.test(id || "")) return null;
  const { data } = await db()
    .from("venues")
    .select(VENUE_FIELDS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return (await withCovers([data]))[0] || null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const venue = await loadVenue(id);
  if (!venue) return { title: "Place not found · Weyn" };
  const description = venue.description || `See ${venue.name}${venue.neighborhood ? ` in ${venue.neighborhood}` : ""} on Weyn.`;
  return {
    title: `${venue.name} · Weyn`,
    description,
    openGraph: { title: `${venue.name} · Weyn`, description },
  };
}

export default async function SharedVenuePage({ params }) {
  const { id } = await params;
  const venue = await loadVenue(id);

  if (!venue) {
    return (
      <main className="screen-collection-detail">
        <p className="eyebrow">Shared place</p>
        <h1>This place is unavailable</h1>
        <p className="sub">It may have been removed or the link may be incomplete.</p>
        <Link className="btn primary" href="/app">Discover places →</Link>
      </main>
    );
  }

  return (
    <main className="screen-collection-detail">
      <header>
        <p className="eyebrow">Shared from Weyn</p>
        <h1>{venue.name}</h1>
        <p className="sub">Open the place, save it, review it, or get directions.</p>
      </header>
      <div className="venue-list-single">
        <VenueCard venue={venue} priority>
          <VenueActions venue={venue} />
        </VenueCard>
      </div>
      <Link className="btn ghost" href="/app">← Back to Weyn</Link>
    </main>
  );
}
