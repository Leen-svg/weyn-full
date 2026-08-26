import "server-only";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";

export async function pollAccess(req, code) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  const service = db();
  const { data: poll } = await service.from("polls")
    .select("id,short_code,created_by,visibility,expires_at,created_at")
    .eq("short_code", code)
    .maybeSingle();
  if (!poll) return { allowed: false, status: 404, error: "Poll not found", user, service };
  if (poll.visibility === "public" || (user && poll.created_by === user.id)) return { allowed: true, poll, user, service };
  if (!user) return { allowed: false, status: 401, error: "Log in to open this vote", poll, user, service };

  let acceptedFriend = false;
  if (poll.visibility === "friends" && poll.created_by) {
    const { data: friendship } = await service.from("friendships").select("id").eq("status", "accepted")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${poll.created_by}),and(requester_id.eq.${poll.created_by},addressee_id.eq.${user.id})`)
      .maybeSingle();
    acceptedFriend = Boolean(friendship);
  }

  const { data: shares } = await service.from("group_messages").select("group_id").eq("share_type", "poll").eq("share_id", poll.id);
  const groupIds = [...new Set((shares || []).map((share) => share.group_id))];
  const { data: membership } = groupIds.length
    ? await service.from("friend_group_members").select("group_id").eq("user_id", user.id).in("group_id", groupIds).limit(1)
    : { data: [] };
  const allowed = acceptedFriend || Boolean(membership?.length);
  return { allowed, status: allowed ? 200 : 403, error: allowed ? null : "This vote is private", poll, user, service };
}
