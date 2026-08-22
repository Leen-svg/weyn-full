import { getTaxonomy } from "@/lib/taxonomy";
import { createClient } from "@/lib/supabase/server";
import VibeSelector from "@/components/VibeSelector";
import ComingSoonMap from "@/components/ComingSoonMap";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Find Where to Go in Abu Dhabi and Dubai",
  description: "Choose your city, mood, activity, budget, and optional Near Me filter. Weyn gives you three curated places and a quick group vote.",
  path: "/find",
});

export default async function FindPage() {
  const [{ groups, zones }, supabase] = await Promise.all([getTaxonomy(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <h1>We&apos;re feeling…</h1>
      <p className="sub">Tap what fits. We&apos;ll pull three spots, then you can send it to the group.</p>

      <div style={{ marginTop: 34 }}>
        <VibeSelector groups={groups} zones={zones} isLoggedIn={!!user} />
      </div>

      <ComingSoonMap />
    </>
  );
}




