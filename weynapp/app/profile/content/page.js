import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserContentManager from "@/components/UserContentManager";
import styles from "@/components/AccountPages.module.css";

export const metadata = { title: "Your posts and reviews, Weyn" };

export default async function ProfileContentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/content");
  return (
    <div className={styles.pageNarrow}>
      <header className={styles.header}>
        <Link href="/profile" className={styles.backLink}>← Your profile</Link>
        <span className="eyebrow">Your activity</span>
        <h1>Posts &amp; reviews</h1>
        <p className="sub">Change the audience, archive anything you want out of sight, or delete it permanently.</p>
      </header>
      <UserContentManager />
    </div>
  );
}
