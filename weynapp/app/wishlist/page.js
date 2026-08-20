import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WishlistClient from "@/components/WishlistClient";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Your Saved Places",
  description: "Your private list of Abu Dhabi places saved on Weyn.",
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

  const venues = (data || []).map((row) => row.venues).filter(Boolean);

  return (
    <>
      <h1>Your wishlist</h1>
      <p className="sub">Spots you&apos;ve saved to try.</p>
      <WishlistClient initialVenues={venues} />
    </>
  );
}

