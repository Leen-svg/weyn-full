import { db } from "./db";

// Fire-and-forget in-app notification. Never throws — notifications are a
// bonus, not something that should block the action that triggered them.
export async function notify(userId, type, payload = {}) {
  try {
    await db().from("notifications").insert({ user_id: userId, type, payload });
  } catch (e) {
    console.error("notify failed:", e.message);
  }
}

export async function notifyMany(userIds, type, payload = {}) {
  const rows = [...new Set(userIds)].filter(Boolean).map((user_id) => ({ user_id, type, payload }));
  if (!rows.length) return;
  try {
    await db().from("notifications").insert(rows);
  } catch (e) {
    console.error("notifyMany failed:", e.message);
  }
}
