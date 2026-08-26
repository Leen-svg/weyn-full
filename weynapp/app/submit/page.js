import { getTaxonomy } from "@/lib/taxonomy";
import SubmitForm from "@/components/SubmitForm";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Add a UAE Spot",
  description: "Know an Abu Dhabi or Dubai restaurant, cafe, activity, or hidden gem Weyn is missing? Submit it for review and help the community discover it.",
  path: "/submit",
});

export default async function SubmitPage() {
  const { groups, zones } = await getTaxonomy();
  return (
    <div className="screen-propose">
      <header className="screen-propose__header">
        <span className="eyebrow">Propose a spot</span>
        <h1>Add a spot<br />we&apos;re <span className="mark">missing.</span></h1>
        <p className="sub">Every place on Weyn was added by hand. We review every submission before it goes live.</p>
      </header>
      <SubmitForm groups={groups} zones={zones} />
    </div>
  );
}
