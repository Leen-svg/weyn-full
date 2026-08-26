import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { privatePageMetadata } from "@/lib/seo";
import styles from "@/components/AccountPages.module.css";

export const metadata = privatePageMetadata({
  title: "Your Weyn Points",
  description: "See your Weyn points balance, recent activity, and ways to earn more.",
});

const REASON_LABEL = {
  signup_bonus: "Joined Weyn",
  rated_a_place: "Rated a place",
  tried_new_place: "Tried a new place",
  shared_a_spot: "Shared a spot",
  new_person: "Planned with someone new",
  suggested_a_place: "Suggested a place",
  suggested_a_tag_fix: "Improved a place tag",
  viewed_ratings: "Viewed place ratings",
  posted: "Posted a spot",
};

const POINT_RULES = [
  ["Rate a place", "Your first useful rating for a place can earn points."],
  ["Improve Weyn", "Approved places and tag corrections earn points."],
  ["Plan together", "Some group votes and social actions earn points."],
];

const EARN_LINKS = [
  { href: "/submit", label: "Suggest a missing place", points: "+10 after approval" },
  { href: "/rate", label: "Correct a place tag", points: "+5 after approval" },
  { href: "/creators", label: "Submit creator media", points: "Get featured" },
];

export default async function RewardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/rewards");

  const [{ data: profile }, { data: ledger }] = await Promise.all([
    supabase.from("profiles").select("points_balance").eq("id", user.id).single(),
    supabase.from("points_ledger").select("id, delta, reason, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  const balance = profile?.points_balance || 0;

  return (
    <div className={`${styles.page} rewards-page`}>
      <header className={styles.rewardsHero}>
        <div className={styles.rewardsHeroCopy}>
          <span className="eyebrow">Your points</span>
          <h1>Useful contributions add up</h1>
          <p>Earn points for ratings, approved suggestions, and helping your group decide. Perks are coming later; points currently have no cash value.</p>
        </div>
        <div className={styles.balance} aria-label={`${balance} points`}><strong>{balance}</strong><span>points</span></div>
      </header>

      <div className={styles.rewardsGrid}>
        <section className={styles.rewardsPanel}>
          <div className={styles.panelTitle}><span className="eyebrow">Ledger</span><h2>Recent activity</h2></div>
          {!ledger?.length ? (
            <div className={styles.empty}><strong>No point activity yet.</strong><span>Rate a place or suggest an improvement to get started.</span></div>
          ) : (
            <div className={styles.ledger}>
              {ledger.map((item) => (
                <div key={item.id}>
                  <span><strong>{REASON_LABEL[item.reason] || item.reason}</strong><small>{new Date(item.created_at).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}</small></span>
                  <b className={item.delta >= 0 ? styles.positive : styles.negative}>{item.delta >= 0 ? "+" : ""}{item.delta}</b>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className={styles.rewardsAside}>
          <section className={styles.rewardsPanel}>
            <div className={styles.panelTitle}><span className="eyebrow">Simple rules</span><h2>How points work</h2></div>
            <div className={styles.ruleList}>
              {POINT_RULES.map(([title, body]) => <div key={title}><strong>{title}</strong><span>{body}</span></div>)}
            </div>
          </section>

          <section className={styles.rewardsPanel}>
            <div className={styles.panelTitle}><span className="eyebrow">Contribute</span><h2>Earn more</h2></div>
            <div className={styles.linkList}>
              {EARN_LINKS.map((item) => <Link href={item.href} key={item.href}><span><strong>{item.label}</strong><small>{item.points}</small></span><b aria-hidden="true">→</b></Link>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
