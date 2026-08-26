import { db } from "@/lib/db";

export const QUARANTINE_BUCKET = "community-media-quarantine";
export const PUBLIC_MEDIA_BUCKET = "venue-media";

export async function removeCommunityMediaRows(rows) {
  const items = (rows || []).filter(Boolean);
  if (!items.length) return;
  const service = db();
  const quarantine = items.map((item) => item.storage_path).filter(Boolean);
  const published = items.map((item) => item.public_path).filter(Boolean);
  if (quarantine.length) await service.storage.from(QUARANTINE_BUCKET).remove(quarantine);
  if (published.length) await service.storage.from(PUBLIC_MEDIA_BUCKET).remove(published);
  await service.from("community_media").delete().in("id", items.map((item) => item.id));
}

export async function ownedPendingMedia({ id, userId, contextType }) {
  if (!id) return null;
  const { data } = await db().from("community_media")
    .select("id,user_id,context_type,context_id,status,storage_path,public_path")
    .eq("id", id).eq("user_id", userId).eq("context_type", contextType).eq("status", "pending").is("context_id", null).maybeSingle();
  return data || null;
}

