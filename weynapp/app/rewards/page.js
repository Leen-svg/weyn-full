import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Rewards, Weyn" };

const REASON_LABEL = {
  signup_bonus: "Joined weyn",
  rated_a_place: "Rated a place ⭐",
  tried_new_place: "Tried a new place 🏅",
  shared_a_spot: "Shared a spot 📣",
  new_person: "Made a new friend 👋",
  suggested_a_place: "Suggested a place 📍",
  suggested_a_tag_fix: "Suggested a tag fix 🏷️",
  viewed_ratings: "Checked out ratings 👀",
  posted: "Posted a spot 📣",
};

const CATEGORIES = [
  { emoji: "⭐", label: "Rate a place", body: "Your first rating for each place earns 15 points." },
  { emoji: "👋", label: "New people", body: "Vote in a group poll with someone new for 5 points, once per person and up to 3 times a day." },
  { emoji: "📣", label: "Share it", body: "Send a poll to the group." },
];

const EARN_MORE = [
  { emoji: "📍", label: "Add a spot", body: "Submit a missing place. You earn points after it is approved.", href: "/submit", pts: "+10" },
  { emoji: "🏷️", label: "Rate our tags", body: "Suggest a tag correction. You earn points after it is approved.", href: "/rate", pts: "+5" },
  { emoji: "🎬", label: "Creators", body: "Got a video for a spot? Get featured and credited.", href: "/creators", pts: "" },
];

export default async function RewardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/rewards");

  const [{ data: profile }, { data: ledger }] = await Promise.all([
    supabase.from("profiles").select("points_balance").eq("id", user.id).single(),
    supabase.from("points_ledger").select("id, delta, reason, created_at").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <>
      <h1>Rewards</h1>
      <p className="sub">Every point is banked and yours, we&apos;re building out real perks to redeem them for soon. Keep earning, it&apos;ll be worth it. 🏅</p>

      <Card className="mb-5" style={{ background: "var(--purple)", color: "var(--white)" }}>
        <CardContent className="pt-6 text-center">
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">Your balance</div>
          <div className="mt-1 text-5xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            {profile?.points_balance ?? 0}
          </div>
          <div className="mt-1 text-sm opacity-80">points</div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>How you earn them</CardTitle>
          <CardDescription>Weyn rewards discovering your city with your people. Redeeming for real perks is coming.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => (
              <div key={c.label} className="rounded-lg border p-3 text-center">
                <div className="text-2xl">{c.emoji}</div>
                <div className="mt-1 text-sm font-semibold">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.body}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Ways to earn more</CardTitle>
          <CardDescription>Contribute to Weyn and rack up points.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {EARN_MORE.map((c) => (
            <Link key={c.href} href={c.href} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
              <div className="text-2xl">{c.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.body}</div>
              </div>
              {c.pts && <Badge variant="outline">{c.pts}</Badge>}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!ledger?.length && <p className="text-sm text-muted-foreground">Nothing yet, go find a spot.</p>}
          {ledger?.map((l) => (
            <div key={l.id} className="flex items-center justify-between border-b py-2 last:border-0">
              <div>
                <div className="text-sm font-medium">{REASON_LABEL[l.reason] || l.reason}</div>
                <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</div>
              </div>
              <Badge variant={l.delta >= 0 ? "default" : "destructive"}>
                {l.delta >= 0 ? "+" : ""}
                {l.delta}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

