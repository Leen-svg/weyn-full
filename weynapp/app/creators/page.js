import { db } from "@/lib/db";
import CreatorForm from "@/components/CreatorForm";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "UAE Creators",
  description: "Submit your Abu Dhabi or Dubai place video to Weyn. Featured creators are credited on the venue card with a direct link to their TikTok.",
  path: "/creators",
});

async function loadVenues() {
  try {
    const { data } = await db()
      .from("venues")
      .select("id, name, neighborhood, hero_video_url")
      .eq("is_active", true)
      .order("name");
    return data || [];
  } catch (e) {
    console.error("creators loadVenues failed:", e.message);
    return [];
  }
}

export default async function CreatorsPage() {
  const venues = await loadVenues();

  return (
    <>
      <h1>Get your video<br />in the <span className="mark">group chat.</span></h1>
      <p className="sub">
        Weyn shows one short video per spot. Submit yours, if we feature it, your handle is credited
        on the card and links straight back to your TikTok. Spots without a video get picked first.
      </p>
      <CreatorForm venues={venues || []} />
    </>
  );
}

