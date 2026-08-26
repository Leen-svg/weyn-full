import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { removeCommunityMediaRows } from "@/lib/community-media-server";

export async function DELETE(req) {
  if (payloadTooLarge(req, 8 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to delete your account" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });

  const service = db();
  const { data: media } = await service.from("community_media")
    .select("id,storage_path,public_path")
    .eq("user_id", user.id);
  await removeCommunityMediaRows(media);

  const { data: avatarFiles } = await service.storage.from("avatars").list(user.id, { limit: 100 });
  const avatarPaths = (avatarFiles || []).filter((file) => file.name).map((file) => `${user.id}/${file.name}`);
  if (avatarPaths.length) await service.storage.from("avatars").remove(avatarPaths);

  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "We couldn’t delete the account. Please try again or contact support." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
