import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationCenter from "@/components/NotificationCenter";
import { privatePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = privatePageMetadata({
  title: "Notifications",
  description: "Votes, group messages and plan updates from your people.",
});

/* The notification centre. Notifications previously existed only as a
   dropdown off the nav bell, which caps at what fits in a popover and
   is unreachable on a phone once the nav collapses. This is the same
   data, given a screen. The bell still works exactly as before. */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/notifications");

  // Rendered server-side so the list is there on first paint; the
  // client component then takes over for realtime and mark-as-read.
  const { data } = await supabase
    .from("notifications")
    .select("id, type, payload, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <>
      <span className="eyebrow">Your people</span>
      <h1>Notifications</h1>
      <p className="sub">Votes, group messages and plan updates, newest first.</p>
      <NotificationCenter userId={user.id} initialNotifications={data || []} />
    </>
  );
}
