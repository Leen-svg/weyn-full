import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WishlistClient from "@/components/WishlistClient";
import { privatePageMetadata } from "@/lib/seo";
import { withCovers } from "@/lib/venueMedia";

export const metadata = privatePageMetadata({
  title: "Your Saved Places",
  description: "Create and share your own tagged lists of saved UAE places on Weyn.",
});

export default async function WishlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/wishlist");

  const { data } = await supabase
    .from("saves")
    .select("venue_id, venues (*)")
    .order("created_at", { ascending: false });

  const venues = await withCovers((data || []).map((row) => row.venues).filter(Boolean));

  return (
    <>
      <span className="eyebrow">Yours to organise and share</span>
      <h1>Saved</h1>
      <p className="sub">Build custom lists, add your own tags, and share only with the people you choose.</p>
      <WishlistClient initialVenues={venues} />
    </>
  );
}

