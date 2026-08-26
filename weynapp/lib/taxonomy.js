import { unstable_cache } from "next/cache";
import { db } from "./db";

// Fetch the live taxonomy (tags grouped by category + zones) server-side.
// Returns empty arrays if the DB is unreachable so a missing env var degrades
// the page instead of crashing the whole build.
//
// Tags/zones change rarely (admin-curated), so this is cached for a few
// minutes instead of hitting the DB on every /find and group-page load.
const loadTaxonomyCached = unstable_cache(loadTaxonomy, ["weyn-taxonomy"], { revalidate: 300 });

export async function getTaxonomy() {
  try {
    return await loadTaxonomyCached();
  } catch (e) {
    console.error("getTaxonomy failed:", e.message);
    return { groups: [], zones: [] };
  }
}

async function loadTaxonomy() {
  const s = db();
  const [{ data: cats }, { data: tags }, { data: zones }] = await Promise.all([
    s.from("categories").select("id, slug, name, display_order, min_select, max_select").order("display_order"),
    s.from("vibe_tags")
      .select("id, category_id, slug, display_name, subgroup, subgroup_order, display_order, seasonal_exclude")
      .eq("is_active", true)
      .order("subgroup_order")
      .order("display_order"),
    s.from("zones").select("slug, name, emirate, display_order").eq("is_active", true).order("display_order"),
  ]);
  // "Money" is a category in the DB but budget is filtered on avg_spend_aed,
  // not through tags, so drop any category that has no tags.
  const groups = (cats || [])
    .map((c) => ({ ...c, tags: (tags || []).filter((t) => t.category_id === c.id) }))
    .filter((c) => c.tags.length > 0);
  return { groups, zones: zones || [] };
}

