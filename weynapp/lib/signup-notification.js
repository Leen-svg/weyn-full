import "server-only";
import { db } from "@/lib/db";

const RECIPIENT = process.env.SIGNUP_NOTIFICATION_EMAIL || "leen@weyn.com";
const FROM = process.env.RESEND_FROM_EMAIL || "Weyn <notifications@weyn.com>";

export async function notifyNewSignup(user, source = "signup") {
  if (!user?.id || !user?.email) return { sent: false, reason: "missing-user" };
  const service = db();
  const { data: existing } = await service.from("signup_notifications").select("user_id").eq("user_id", user.id).maybeSingle();
  if (existing) return { sent: false, reason: "already-sent" };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("New-member email skipped: RESEND_API_KEY is not configured.");
    return { sent: false, reason: "email-not-configured" };
  }

  const createdAt = user.created_at || new Date().toISOString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [RECIPIENT],
      subject: "A new member joined Weyn 🎉",
      text: `A new member joined Weyn.\n\nEmail: ${user.email}\nJoined: ${createdAt}\nMethod: ${source}\n\nOpen Admin: https://goweyn.com/admin`,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("New-member email failed", response.status, detail.slice(0, 300));
    return { sent: false, reason: "provider-error" };
  }
  const { error } = await service.from("signup_notifications").insert({ user_id: user.id, recipient: RECIPIENT, source });
  if (error && error.code !== "23505") console.error("Could not record signup notification", error.message);
  return { sent: true };
}
