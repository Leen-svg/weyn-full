import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileMenu from "./ProfileMenu";
import NotificationBell from "./NotificationBell";

export default async function AuthNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <Link href="/login">Log in</Link>
        <Link href="/signup" className="btn small">Sign up</Link>
      </>
    );
  }

  const [{ data: profile }, { data: pub }] = await Promise.all([
    supabase.from("profiles").select("points_balance, is_admin").eq("id", user.id).single(),
    supabase.from("profile_public").select("display_name, avatar_url").eq("id", user.id).single(),
  ]);

  return (
    <>
      <NotificationBell userId={user.id} />
      <ProfileMenu
        userId={user.id}
        displayName={pub?.display_name}
        avatarUrl={pub?.avatar_url}
        points={profile?.points_balance ?? 0}
        isAdmin={!!profile?.is_admin}
      />
    </>
  );
}


