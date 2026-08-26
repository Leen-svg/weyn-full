import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to see your wishlist" }, { status: 401 });

  const { data, error } = await supabase
    .from("saves")
    .select("venue_id, created_at, venues (*)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saves: data || [] });
}

export async function POST(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to save spots" }, { status: 401 });

  const { venueId } = await req.json();
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { error } = await supabase.from("saves").insert({ user_id: user.id, venue_id: venueId });
  if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to manage your wishlist" }, { status: 401 });

  const { venueId } = await req.json();
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const { error } = await supabase.from("saves").delete().eq("user_id", user.id).eq("venue_id", venueId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
