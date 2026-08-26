import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GroupsClient from "@/components/GroupsClient";
import { privatePageMetadata } from "@/lib/seo";
import styles from "@/components/AccountPages.module.css";

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
    <div className={`${styles.page} screen-messages`}>
      <header className={`${styles.header} ${styles.groupHeader}`}>
        <span className="eyebrow">Your people</span>
        <h1>Messages</h1>
        <p className="sub">Group up with friends, vote on where to go, chat about it.</p>
      </header>
      <GroupsClient />
    </div>
  );
}
