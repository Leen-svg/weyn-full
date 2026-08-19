import { getTaxonomy } from "@/lib/taxonomy";
import SubmitForm from "@/components/SubmitForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a spot, Weyn" };

export default async function SubmitPage() {
  const { groups, zones } = await getTaxonomy();
  return (
    <>
      <h1>Add a spot<br />we&apos;re <span className="mark">missing.</span></h1>
      <p className="sub">Every place on Weyn was added by hand. We review every submission before it goes live.</p>
      <SubmitForm groups={groups} zones={zones} />
    </>
  );
}
