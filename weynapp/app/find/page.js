import { getTaxonomy } from "@/lib/taxonomy";
import { createClient } from "@/lib/supabase/server";
import VibeSelector from "@/components/VibeSelector";
import NearbySection from "@/components/NearbySection";
import ComingSoonMap from "@/components/ComingSoonMap";

export const metadata = { title: "Find a spot, Weyn" };

export default async function FindPage() {
  const [{ groups, zones }, supabase] = await Promise.all([getTaxonomy(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <h1>We&apos;re feeling…</h1>
      <p className="sub">Tap what fits. We&apos;ll pull three spots, then you can send it to the group.</p>

      <NearbySection />

      <div style={{ marginTop: 34 }}>
        <VibeSelector groups={groups} zones={zones} isLoggedIn={!!user} />
      </div>

      <ComingSoonMap />
    </>
  );
}
