import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

async function context(id) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Log in" }, { status: 401 }) };
  const service = db();
  const { data: board } = await service.from("trip_boards").select("*").eq("id", id).maybeSingle();
  if (!board) return { response: NextResponse.json({ error: "Board not found" }, { status: 404 }) };
  const { data: member } = await service.from("trip_board_members").select("role").eq("board_id", id).eq("user_id", user.id).maybeSingle();
  if (board.owner_id !== user.id && !member) return { response: NextResponse.json({ error: "You don't have access to this board" }, { status: 403 }) };
  return { user, board, member, service };
}

export async function GET(req, { params }) {
  const { id } = await params; const ctx = await context(id); if (ctx.response) return ctx.response;
  const [{ data: places }, { data: members }] = await Promise.all([
    ctx.service.from("trip_board_places").select("id,position,venue_id,personal_place_id,venues(id,name,neighborhood,city,latitude,longitude,google_maps_url),personal_places(id,name,neighborhood,city,latitude,longitude),trip_board_votes(user_id,vote)").eq("board_id", id).order("position"),
    ctx.service.from("trip_board_members").select("user_id,role").eq("board_id", id),
  ]);
  const memberIds = (members || []).map((member) => member.user_id);
  const { data: profiles } = memberIds.length ? await ctx.service.from("profile_public").select("id,display_name,avatar_url").in("id", memberIds) : { data: [] };
  const profileMap = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  return NextResponse.json({ board: ctx.board, owner: ctx.board.owner_id === ctx.user.id, members: (members || []).map((member) => ({ ...member, profile: profileMap[member.user_id] || null })), places: (places || []).map((row) => ({ ...row, ...(row.venues || row.personal_places), myVote: row.trip_board_votes?.find((vote) => vote.user_id === ctx.user.id)?.vote || 0, score: (row.trip_board_votes || []).reduce((total, vote) => total + vote.vote, 0) })) });
}

export async function PATCH(req, { params }) {
  const { id } = await params; const ctx = await context(id); if (ctx.response) return ctx.response;
  const body = await req.json();
  if (body.action === "add") {
    if (body.kind === "personal") { const { data: personal } = await ctx.service.from("personal_places").select("id").eq("id", body.placeId).eq("user_id", ctx.user.id).maybeSingle(); if (!personal) return NextResponse.json({ error: "Private place not found" }, { status: 404 }); }
    else { const { data: venue } = await ctx.service.from("venues").select("id").eq("id", body.placeId).maybeSingle(); if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 }); }
    const row = { board_id: id, added_by: ctx.user.id, position: Number(body.position) || 0, venue_id: body.kind === "venue" ? body.placeId : null, personal_place_id: body.kind === "personal" ? body.placeId : null };
    const { error } = await ctx.service.from("trip_board_places").insert(row); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (body.action === "vote") {
    const { data: place } = await ctx.service.from("trip_board_places").select("id").eq("id", body.placeId).eq("board_id", id).maybeSingle();
    if (!place) return NextResponse.json({ error: "Place not found on this board" }, { status: 404 });
    const vote = body.vote === -1 ? -1 : 1; const { error } = await ctx.service.from("trip_board_votes").upsert({ board_place_id: body.placeId, user_id: ctx.user.id, vote });
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }
  if (body.action === "removePlace") { const { error } = await ctx.service.from("trip_board_places").delete().eq("id", body.placeId).eq("board_id", id); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true }); }
  if (body.action === "reorder" && Array.isArray(body.placeIds)) { for (const [position, placeId] of body.placeIds.slice(0, 50).entries()) await ctx.service.from("trip_board_places").update({ position }).eq("id", placeId).eq("board_id", id); return NextResponse.json({ ok: true }); }
  if (ctx.board.owner_id !== ctx.user.id) return NextResponse.json({ error: "Only the board owner can do that" }, { status: 403 });
  if (body.action === "publish") { const { error } = await ctx.service.from("trip_boards").update({ is_public: !!body.value }).eq("id", id); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true }); }
  if (body.action === "rename") { const title = String(body.title || "").trim().slice(0, 80); if (!title) return NextResponse.json({ error: "Name your board" }, { status: 400 }); const { error } = await ctx.service.from("trip_boards").update({ title }).eq("id", id); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true }); }
  if (body.action === "invite") { const name = String(body.displayName || "").trim().slice(0, 80); const { data: person } = await ctx.service.from("profile_public").select("id").eq("display_name", name).neq("id", ctx.user.id).limit(1).maybeSingle(); if (!person) return NextResponse.json({ error: "No Weyn account found with that exact display name" }, { status: 404 }); const { error } = await ctx.service.from("trip_board_members").upsert({ board_id: id, user_id: person.id, role: "member" }); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true }); }
  if (body.action === "removeMember") { const { error } = await ctx.service.from("trip_board_members").delete().eq("board_id", id).eq("user_id", body.userId).eq("role", "member"); return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true }); }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req, { params }) {
  const { id } = await params; const ctx = await context(id); if (ctx.response) return ctx.response;
  if (ctx.board.owner_id !== ctx.user.id) return NextResponse.json({ error: "Only the owner can delete this board" }, { status: 403 });
  const { error } = await ctx.service.from("trip_boards").delete().eq("id", id); return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
