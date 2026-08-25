import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupsClient from "@/components/GroupsClient";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Your Groups",
  description: "Plan outings in Abu Dhabi and Dubai, chat, and vote on places with your Weyn groups.",
});

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/groups");

  return (
    <>
      <p className="eyebrow">Together</p>
      <h1>Your groups</h1>
      <p className="sub">Vote on a spot. Chat. Actually go.</p>
      <GroupsClient />
    </>
  );
}


