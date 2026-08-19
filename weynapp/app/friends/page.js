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
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ marginBottom: 0 }}>Friends</h1>
        <Link className="btn small" href="/groups">
          👋 Groups →
        </Link>
      </div>
      <p className="sub">Add people, vote together, see where they&apos;ve been, only if they let you.</p>
      <FriendsClient />
    </>
  );
}
