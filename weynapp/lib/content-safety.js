import { db } from "@/lib/db";

const URL_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:com|net|org|io|ae|co|app|xyz|link)\b)/i;
const HIGH_CONFIDENCE_BLOCKED_PATTERN = /\b(?:porn(?:ography)?|xxx|nudes?|onlyfans|rape|kill\s+yourself|kys|scam(?:mer|med)?|fraud(?:ulent)?|stole|stolen|roaches?|poison(?:ed|ing)?)\b/i;

export function validateCommunityText(value, { required = false, maxLength = 500 } = {}) {
  const text = String(value || "").trim();
  if (required && !text) return { error: "Write something before posting." };
  if (text.length > maxLength) return { error: "Keep it under " + maxLength + " characters." };
  if (URL_PATTERN.test(text)) return { error: "Links aren't allowed in community posts." };
  if (HIGH_CONFIDENCE_BLOCKED_PATTERN.test(text)) return { error: "Please describe the experience without accusations, explicit language, or threats." };
  return { text: text || null };
}

export async function contentAccountError(user) {
  if (!user?.id) return "Log in to continue.";
  if (!user.email_confirmed_at) return "Confirm your email before posting.";
  const { data } = await db().from("profiles").select("is_banned").eq("id", user.id).maybeSingle();
  return data?.is_banned ? "This account is suspended from posting." : null;
}

export function utcDayStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

