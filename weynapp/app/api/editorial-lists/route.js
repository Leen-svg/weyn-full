import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const { data, error } = await db().from("editorial_lists")
    .select("id, title, subtitle, slug, city, header_image_url, home_section, sort_order, editorial_list_items(position, venues(id, name, neighborhood, city, avg_spend_aed, venue_tags(vibe_tags(slug, display_name))))")
    .eq("is_published", true).order("home_section").order("sort_order").order("created_at");
  if (error) return NextResponse.json({ error: "Could not load Weyn lists" }, { status: 500 });
  const lists = (data || []).map((list) => ({
    id: list.id, title: list.title, subtitle: list.subtitle || "", city: list.city,
    headerImageUrl: list.header_image_url, slug: list.slug, homeSection: list.home_section || "curated",
    venues: (list.editorial_list_items || []).sort((a, b) => a.position - b.position).map((item) => ({
      id: item.venues.id, name: item.venues.name, area: item.venues.neighborhood || item.venues.city,
      price: `~${item.venues.avg_spend_aed || 0} AED pp`,
      tags: (item.venues.venue_tags || []).map((tag) => tag.vibe_tags?.display_name || tag.vibe_tags?.slug).filter(Boolean),
    })),
  }));
  return NextResponse.json({ lists }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
}
