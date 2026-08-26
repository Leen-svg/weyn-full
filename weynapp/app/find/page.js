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
    <div className="screen-find">
      <header className="screen-find__header">
        <span className="eyebrow">Find your next spot</span>
        <h1>We&apos;re feeling…</h1>
        <p className="sub">Tap what fits, or tell Weyn in a sentence. Three spots, then the group votes.</p>
      </header>

      <div className="screen-find__selector">
        <VibeSelector groups={groups} zones={zones} isLoggedIn={!!user} />
      </div>

      <ComingSoonMap />
    </div>
  );
}
