import { createClient } from "@/lib/supabase/server";
import { awardPoints, POINTS } from "@/lib/points";
import { NextResponse } from "next/server";

export async function POST(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const { friendshipId, action } = await req.json();
  if (!friendshipId || !["accept", "decline"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // RLS already restricts this update to the addressee, but we check
  // explicitly too so we know whether to award points below.
  const { data: row, error: readErr } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .eq("id", friendshipId)
    .single();
  if (readErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.addressee_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (row.status !== "pending") return NextResponse.json({ error: "Already resolved" }, { status: 409 });

  const status = action === "accept" ? "accepted" : "declined";
  const { error } = await supabase
    .from("friendships")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "accepted") {
    await awardPoints(row.requester_id, POINTS.new_person, "new_person");
    await awardPoints(row.addressee_id, POINTS.new_person, "new_person");
  }

  return NextResponse.json({ ok: true });
}
