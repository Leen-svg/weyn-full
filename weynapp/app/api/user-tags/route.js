import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { isVisibility } from "@/lib/visibility.mjs";
import { payloadTooLarge } from "@/lib/request-security.mjs";

const cleanIds = (values) => [...new Set((Array.isArray(values) ? values : []).map(String))].slice(0, 100);

async function auth(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(req) {
  const { supabase, user } = await auth(req);
  if (!user) return NextResponse.json({ error: "Log in to see your tags" }, { status: 401 });
  const { data, error } = await supabase.from("user_tags")
    .select("id,name,description,visibility,share_slug,archived_at,created_at,user_tag_venues(venue_id)")
    .eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: bookmarkRows } = await db().from("user_tag_bookmarks").select("tag_id").eq("user_id", user.id);
  const bookmarkIds = (bookmarkRows || []).map((row) => row.tag_id);
  const { data: bookmarked } = bookmarkIds.length
    ? await supabase.from("user_tags").select("id,name,description,visibility,share_slug,user_id,user_tag_venues(venue_id)").in("id", bookmarkIds).is("archived_at", null)
    : { data: [] };
  return NextResponse.json({ tags: (data || []).filter((tag) => !tag.archived_at), archived: (data || []).filter((tag) => tag.archived_at), bookmarked: bookmarked || [] });
}

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { supabase, user } = await auth(req);
  if (!user) return NextResponse.json({ error: "Log in to create a tag" }, { status: 401 });
  const body = await req.json();
  const name = String(body.name || "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "Give your tag a name" }, { status: 400 });
  if (!isVisibility(body.visibility)) return NextResponse.json({ error: "Choose who can see this tag" }, { status: 400 });
  const { data: tag, error } = await supabase.from("user_tags").insert({
    user_id: user.id, name, description: String(body.description || "").trim().slice(0, 240), visibility: body.visibility,
  }).select("id,share_slug,visibility").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "You already have a tag with that name" : error.message }, { status: 400 });
  const venueIds = cleanIds(body.venueIds);
  if (venueIds.length) {
    const { data: venues } = await db().from("venues").select("id").in("id", venueIds);
    const valid = new Set((venues || []).map((venue) => venue.id));
    const rows = venueIds.filter((id) => valid.has(id)).map((venue_id) => ({ tag_id: tag.id, venue_id }));
    if (rows.length) await supabase.from("user_tag_venues").insert(rows);
  }
  return NextResponse.json({ ok: true, tag });
}

export async function PATCH(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const { supabase, user } = await auth(req);
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const body = await req.json();
  const id = String(body.id || "");
  const { data: tag } = await supabase.from("user_tags").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  if (body.action === "archive" || body.action === "restore") {
    const { error } = await supabase.from("user_tags").update({ archived_at: body.action === "archive" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  // Add or remove one place without rewriting the tag's whole membership.
  // "update" replaces every venue on the tag, which is wrong for tagging a
  // single saved place and races when two cards are tagged in quick succession.
  if (body.action === "attach" || body.action === "detach") {
    const venueId = String(body.venueId || "");
    if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

    if (body.action === "detach") {
      const { error } = await supabase.from("user_tag_venues").delete().eq("tag_id", id).eq("venue_id", venueId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { data: venue } = await db().from("venues").select("id").eq("id", venueId).maybeSingle();
      if (!venue) return NextResponse.json({ error: "That place is not available" }, { status: 404 });
      const { error } = await supabase.from("user_tag_venues").insert({ tag_id: id, venue_id: venueId });
      // 23505 means it is already on the tag, which is the desired end state.
      if (error && error.code !== "23505") return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await supabase.from("user_tags").update({ updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "update") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const name = String(body.name || "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "Give your tag a name" }, { status: 400 });
  if (!isVisibility(body.visibility)) return NextResponse.json({ error: "Choose who can see this tag" }, { status: 400 });
  const { error } = await supabase.from("user_tags").update({ name, description: String(body.description || "").trim().slice(0, 240), visibility: body.visibility, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const venueIds = cleanIds(body.venueIds);
  const { data: venues } = venueIds.length ? await db().from("venues").select("id").in("id", venueIds) : { data: [] };
  const valid = new Set((venues || []).map((venue) => venue.id));
  await supabase.from("user_tag_venues").delete().eq("tag_id", id);
  const rows = venueIds.filter((venueId) => valid.has(venueId)).map((venue_id) => ({ tag_id: id, venue_id }));
  if (rows.length) await supabase.from("user_tag_venues").insert(rows);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { supabase, user } = await auth(req);
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabase.from("user_tags").delete().eq("id", id).eq("user_id", user.id);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
