import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req) {
  const supabase = await createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to see friends" }, { status: 401 });

  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status, created_at")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data || [];
  const otherIds = rows.map((r) => (r.requester_id === user.id ? r.addressee_id : r.requester_id));
  let profiles = {};
  if (otherIds.length) {
    const { data: pubs } = await supabase.from("profile_public").select("id, display_name, avatar_url").in("id", otherIds);
    profiles = Object.fromEntries((pubs || []).map((p) => [p.id, p]));
  }

  const shaped = rows.map((r) => {
    const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
    return {
      id: r.id,
      status: r.status,
      direction: r.requester_id === user.id ? "outgoing" : "incoming",
      other: profiles[otherId] || { id: otherId },
      created_at: r.created_at,
    };
  });

  return NextResponse.json({
    friends: shaped.filter((r) => r.status === "accepted"),
    incoming: shaped.filter((r) => r.status === "pending" && r.direction === "incoming"),
    outgoing: shaped.filter((r) => r.status === "pending" && r.direction === "outgoing"),
  });
}

export async function POST(req) {
  const supabase = await createClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to add friends" }, { status: 401 });

  const { addresseeId } = await req.json();
  if (!addresseeId || addresseeId === user.id) {
    return NextResponse.json({ error: "Invalid friend" }, { status: 400 });
  }

  const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: addresseeId });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Already sent or already friends" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
