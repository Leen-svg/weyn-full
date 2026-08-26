import { db } from "@/lib/db";
import { currentSession } from "@/lib/session";
import { withCovers } from "@/lib/venueMedia";
import DiscoverFeed from "@/components/DiscoverFeed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

const VENUE_FIELDS =
  "id, name, neighborhood, city, latitude, longitude, avg_spend_aed, google_maps_url, hero_video_url, menu_url, is_aesthetic, age_restriction, description";

// One place fills the screen, so the feed is paged rather than exhaustive:
// enough to browse for a while, not the whole table.
const FEED_SIZE = 40;

export default async function DiscoverPage() {
  const { supabase } = await currentSession();
  const [{ data: rows }, { data: { user } = {} }] = await Promise.all([
    db()
      .from("venues")
      .select(VENUE_FIELDS)
      .eq("is_active", true)
      .order("is_trending", { ascending: false })
      .order("trending_rank", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(FEED_SIZE),
    supabase.auth.getUser(),
  ]);

  const venues = await withCovers(rows || [], { maxMediaPerVenue: 4 });

  let savedIds = [];
  if (user) {
    const { data: saves } = await supabase.from("saves").select("venue_id").eq("user_id", user.id);
    savedIds = (saves || []).map((s) => s.venue_id);
  }

  return <DiscoverFeed venues={venues} savedIds={savedIds} isLoggedIn={!!user} />;
}
