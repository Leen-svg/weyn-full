import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = (friendships || []).map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
  if (!friendIds.length) return NextResponse.json({ activity: [] });

  const { data: sharingFriends } = await supabase
    .from("profile_public")
    .select("id, display_name, avatar_url")
    .in("id", friendIds)
    .eq("share_activity_with_friends", true)
    .eq("ghost_mode", false);

  const sharingIds = (sharingFriends || []).map((f) => f.id);
  if (!sharingIds.length) return NextResponse.json({ activity: [] });

  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, rating, body, aesthetic_taste, quiet_loud, wallet_splurge, created_at, user_id, venues (id, name, neighborhood)")
    .in("user_id", sharingIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byId = Object.fromEntries(sharingFriends.map((f) => [f.id, f]));
  const activity = (reviews || []).map((r) => ({ ...r, friend: byId[r.user_id] }));

  return NextResponse.json({ activity });
}
