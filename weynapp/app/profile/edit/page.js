import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/taxonomy";
import ProfileForm from "@/components/ProfileForm";
import styles from "@/components/AccountPages.module.css";
import AccountSecurity from "@/components/AccountSecurity";

export const metadata = { title: "Edit your profile, Weyn" };

export default async function EditProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/edit");

  const [{ data: pub }, { data: preferences }, { groups }] = await Promise.all([
    supabase.from("profile_public").select("display_name, avatar_url, bio, share_activity_with_friends").eq("id", user.id).single(),
    supabase.from("profile_favorite_preferences").select("favorite_tags,visibility").eq("user_id", user.id).maybeSingle(),
    getTaxonomy(),
  ]);

  return (
    <div className={`${styles.pageNarrow} profile-edit-page`}>
      <header className={styles.header}>
        <Link href="/profile" className={styles.backLink}>← Your profile</Link>
        <span className="eyebrow">Settings</span>
        <h1>Edit profile</h1>
        <p className="sub">Update what people see and choose what stays private. Your recommendation preferences are optional.</p>
      </header>
      <ProfileForm initial={{ ...(pub || {}), favorite_tags: preferences?.favorite_tags || [], favorite_tags_visibility: preferences?.visibility || "" }} groups={groups} />
      <section className="account-security" aria-label="Account settings">
        <h2 className="group-label">Account</h2>
        <AccountSecurity email={user.email} />
      </section>
    </div>
  );
}
