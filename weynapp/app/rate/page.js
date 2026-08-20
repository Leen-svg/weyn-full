import { db } from "@/lib/db";
import { getTaxonomy } from "@/lib/taxonomy";
import RateClient from "@/components/RateClient";
import { privatePageMetadata } from "@/lib/seo";

export const revalidate = 0;
export const metadata = privatePageMetadata({
  title: "Help Improve Weyn's Place Tags",
  description: "Tell Weyn when a place's mood, activity, or occasion tags need correcting.",
});

export default async function RatePage() {
  const s = db();
  const { groups } = await getTaxonomy();
  const { data: venues } = await s
    .from("venues")
    .select("id, name, neighborhood, avg_spend_aed, is_aesthetic, hero_video_url, google_maps_url, venue_tags (vibe_tags (slug, display_name))")
    .eq("is_active", true)
    .limit(200);

  const shaped = (venues || []).map((v) => ({
    id: v.id, name: v.name, neighborhood: v.neighborhood,
    avg_spend_aed: v.avg_spend_aed, is_aesthetic: v.is_aesthetic,
    hero_video_url: v.hero_video_url, google_maps_url: v.google_maps_url,
    tagList: (v.venue_tags || []).map((vt) => vt.vibe_tags).filter(Boolean),
  }));

  const allTags = groups.flatMap((g) => g.tags);

  return (
    <>
      <h1>Did we get<br /><span className="mark">this right?</span></h1>
      <p className="sub">You know these places better than a spreadsheet does. Tell us what&apos;s off.</p>
      <RateClient venues={shaped} allTags={allTags} />
    </>
  );
}

