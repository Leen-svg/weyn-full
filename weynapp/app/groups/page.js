import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupsClient from "@/components/GroupsClient";

export const metadata = { title: "Groups, Weyn" };

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/groups");

  return (
    <>
      <h1>Your groups</h1>
      <p className="sub">Group up with friends, vote on where to go, chat about it.</p>
      <GroupsClient />
    </>
  );
}
