import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FriendsClient from "@/components/FriendsClient";

export const metadata = { title: "Friends, Weyn" };

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/friends");

  return (
    <div className="screen-social">
      <header className="screen-social__header">
      <div className="screen-social__title-row">
        <h1>Friends</h1>
        <Link className="btn small" href="/groups">
          👋 Groups →
        </Link>
      </div>
      <p className="sub">Add people, vote together, see where they&apos;ve been, only if they let you.</p>
      </header>
      <FriendsClient />
    </div>
  );
}
