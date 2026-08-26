import Link from "next/link";
import { db } from "@/lib/db";
import { normalizeHttpUrl } from "@/lib/media-url.mjs";
import CuratedListsBrowser from "@/components/CuratedListsBrowser";
import { privatePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = privatePageMetadata({
  title: "Weyn Lists",
  description: "Every curated Weyn collection across Abu Dhabi and Dubai, searchable by place, area or vibe.",
});

/* Index of every published Weyn list.

   Discover shows the curated lists inline, which stops working once there are
   more than a handful. This is their home: all of them, searchable, with each
   card linking to the existing /collections/[id] detail page. */
async function getLists() {
  const { data } = await db()
    .from("editorial_lists")
    .select(
      "id, title, subtitle, city, header_image_url, sort_order, home_section, editorial_list_items(position, venues(id, name, neighborhood, city, venue_tags(vibe_tags(display_name))))",
    )
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (data || []).map((list) => {
    const items = (list.editorial_list_items || []).sort((a, b) => a.position - b.position);
    const venues = items.map((item) => item.venues).filter(Boolean);
    return {
      id: list.id,
      title: list.title,
      description: list.subtitle || "",
      city: list.city || "",
      coverUrl: normalizeHttpUrl(list.header_image_url) || null,
      venueCount: venues.length,
      venues: venues.map((venue) => ({
        name: venue.name,
        neighborhood: venue.neighborhood,
        city: venue.city,
        tags: (venue.venue_tags || [])
          .map((link) => link.vibe_tags?.display_name)
          .filter(Boolean),
      })),
    };
  });
}

export default async function CollectionsPage() {
  const lists = await getLists();

  return (
    <div className="screen-collections">
      <header className="app-home__section-header">
        <div>
          <h1>Weyn lists</h1>
          <p className="sub">Collections we keep updated across Abu Dhabi and Dubai.</p>
        </div>
        <Link className="btn small ghost" href="/app">
          Back to Discover
        </Link>
      </header>

      <CuratedListsBrowser lists={lists} />
    </div>
  );
}
