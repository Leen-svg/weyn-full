import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTaxonomy } from "@/lib/taxonomy";
import ProfileForm from "@/components/ProfileForm";

export const metadata = { title: "Your profile, Weyn" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");

  const [{ data: profile }, { data: pub }, { groups }] = await Promise.all([
    supabase.from("profiles").select("points_balance, created_at").eq("id", user.id).single(),
    supabase
      .from("profile_public")
      .select("display_name, avatar_url, bio, favorite_tags, share_activity_with_friends")
      .eq("id", user.id)
      .single(),
    getTaxonomy(),
  ]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Your profile</h1>
        <a className="btn small" href={`/u/${user.id}`} target="_blank" rel="noopener noreferrer">
          👀 See how others see you
        </a>
      </div>
      <p className="sub">
        {profile?.points_balance ?? 0} points · member since{" "}
        {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ", "}
      </p>
      <ProfileForm initial={pub || {}} groups={groups} />
    </>
  );
}

