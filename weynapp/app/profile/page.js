import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { viewerAccess } from "@/lib/session";
import { safeUrl } from "@/lib/sanitize";
import { FEATURES } from "@/lib/features";
import AgePreference from "@/components/AgePreference";
import styles from "@/components/AccountPages.module.css";

export const metadata = { title: "Your profile, Weyn" };

const LIBRARY_LINKS = [
  { href: "/wishlist", label: "Saved places", description: "Lists, personal tags, and places you want to try" },
  { href: "/friends", label: "Friends", description: "Requests and people you plan with", flag: "friends" },
  { href: "/groups", label: "Groups", description: "Chats, polls, and shared decisions", flag: "groups" },
  { href: "/profile/content", label: "Posts & reviews", description: "Change privacy, archive, or delete your activity" },
  { href: "/plan", label: "Perfect Day", description: "Turn saved places into a route" },
  { href: "/rewards", label: "Points", description: "Your balance and recent activity", flag: "points" },
];

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const access = await viewerAccess();
  const [
    { data: profile },
    { data: pub },
    { count: savedCount },
    { count: groupCount },
    { data: friendships },
  ] = await Promise.all([
    supabase.from("profiles").select("points_balance").eq("id", user.id).single(),
    supabase.from("profile_public").select("display_name, avatar_url, bio").eq("id", user.id).single(),
    supabase.from("saves").select("venue_id", { count: "exact", head: true }),
    supabase.from("friend_group_members").select("group_id", { count: "exact", head: true }),
    supabase.from("friendships").select("id").eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
  ]);

  const name = pub?.display_name || "Your profile";
  const avatar = safeUrl(pub?.avatar_url);
  const stats = [
    [savedCount || 0, "Saved"],
    ...(FEATURES.groups ? [[groupCount || 0, "Groups"]] : []),
    ...(FEATURES.friends ? [[friendships?.length || 0, "Friends"]] : []),
  ];
  const libraryLinks = LIBRARY_LINKS.filter((item) => !item.flag || FEATURES[item.flag]);

  return (
    <div className={`${styles.page} profile-hub`}>
      <header className={styles.profileHero}>
        <span className="eyebrow">You</span>
        <div className={styles.profileIdentity}>
          <div className={styles.profileAvatar}>
            {avatar ? <img src={avatar} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div>
            <h1>{name}</h1>
            <p>{FEATURES.points ? `${profile?.points_balance || 0} points · ` : ""}Abu Dhabi &amp; Dubai</p>
          </div>
        </div>
        <p className={styles.profileBio}>{pub?.bio || "Save good places, make a shortlist, and get the group out of the chat."}</p>
        <div className={styles.profileStats}>
          {stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        <div className={styles.profileActions}>
          <Link className="btn primary" href="/profile/edit">Edit profile</Link>
          {FEATURES.publicProfiles && (
            <a className="btn ghost" href={`/u/${user.id}`} target="_blank" rel="noopener noreferrer">View public profile</a>
          )}
        </div>
      </header>

      {access.eligibleFor21Plus && (
        <section className={styles.profilePanel}>
          <div className={styles.panelTitle}><span className="eyebrow">Recommendations</span><h2>What you see</h2></div>
          <AgePreference initial={access.show21Plus} />
        </section>
      )}

      <section className={styles.profilePanel}>
        <div className={styles.panelTitle}><span className="eyebrow">Library</span><h2>Your Weyn</h2></div>
        <div className={styles.linkList}>
          {libraryLinks.map((item) => (
            <Link href={item.href} key={item.href}>
              <span><strong>{item.label}</strong><small>{item.description}</small></span><b aria-hidden="true">→</b>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
