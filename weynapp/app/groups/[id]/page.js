import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { getTaxonomy } from "@/lib/taxonomy";
import GroupDetailClient from "@/components/GroupDetailClient";

export const metadata = { title: "Group, Weyn" };

export default async function GroupPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/groups/${id}`);

  const { data: group } = await supabase.from("friend_groups").select("id, name, created_by, created_at").eq("id", id).maybeSingle();
  if (!group) notFound();

  const [{ data: memberRows }, taxonomy] = await Promise.all([
    supabase.from("friend_group_members").select("user_id").eq("group_id", id),
    getTaxonomy(),
  ]);
  const s = db();
  const { data: members } = await s
    .from("profile_public")
    .select("id, display_name, avatar_url")
    .in("id", (memberRows || []).map((m) => m.user_id));

  return (
    <GroupDetailClient
      groupId={id}
      group={group}
      members={members || []}
      taxonomy={taxonomy}
      currentUserId={user.id}
    />
  );
}
