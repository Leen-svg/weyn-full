import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { contentAccountError } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";

const SOCIAL_HOSTS = new Set(["instagram.com", "www.instagram.com", "tiktok.com", "www.tiktok.com", "vm.tiktok.com"]);
const UAE_CITIES = /\b(?:abu dhabi|dubai|sharjah|ajman|fujairah|ras al khaimah|umm al quwain|al ain|uae|united arab emirates)\b/i;
function clean(value, max = 160) { return String(value || "").trim().slice(0, max); }
function parsedUrl(value) { try { const url = new URL(value.trim()); return url.protocol === "https:" || url.protocol === "http:" ? url : null; } catch { return null; } }

async function socialContext(input) {
  const url = parsedUrl(input.split(/\s/)[0]);
  if (!url || !SOCIAL_HOSTS.has(url.hostname)) return { context: input, socialOnly: false, sourceUrl: null };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4500), headers: { "user-agent": "Mozilla/5.0 WeynBot/1.0" } });
    const html = (await response.text()).slice(0, 120000);
    const bits = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description)["'][^>]+content=["']([^"']+)/gi)].map((match) => match[1]);
    return { context: `${input}\n${bits.join("\n")}`.slice(0, 4000), socialOnly: input.trim() === url.href || (input.trim().split(/\s+/).length === 1 && bits.length === 0), sourceUrl: url.href };
  } catch { return { context: input, socialOnly: input.trim().split(/\s+/).length === 1, sourceUrl: url.href }; }
}

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to import a place" }, { status: 401 });
  const accountError = await contentAccountError(user);
  if (accountError) return NextResponse.json({ error: accountError }, { status: 403 });
  const limited = await rateLimit(req, "place-import", 20, 24 * 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "You've reached today's import limit. Try again tomorrow." }, { status: 429 });
  const { input } = await req.json();
  const raw = clean(input, 4000);
  if (!raw) return NextResponse.json({ error: "Paste a link, caption, or message" }, { status: 400 });
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from("personal_places").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayStart.toISOString());
  if ((count || 0) >= 20) return NextResponse.json({ error: "You've reached today's import limit. Try again tomorrow." }, { status: 429 });

  const source = await socialContext(raw);
  if (source.socialOnly) return NextResponse.json({ error: "That social app hid the place details. Paste the caption or add the place name and UAE city beside the link.", needsDetails: true }, { status: 422 });
  let parsed = { name: clean(raw.split(/\r?\n/)[0]), neighborhood: "", city: "Abu Dhabi" };
  if (process.env.OPENAI_API_KEY) {
    const ai = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Extract one real UAE place. Return JSON with name, neighborhood, city, confidence (0-1). Never invent missing details. Return an empty name if uncertain." }, { role: "user", content: source.context }] }) });
    if (ai.ok) { try { parsed = JSON.parse((await ai.json()).choices?.[0]?.message?.content || "{}"); } catch {} }
  }
  const name = clean(parsed.name), city = clean(parsed.city || "Abu Dhabi", 80), neighborhood = clean(parsed.neighborhood, 120);
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? (name ? 0.6 : 0))));
  if (!name) return NextResponse.json({ error: "I couldn't confidently find a place name. Add the place name and UAE city, then try again.", needsDetails: true }, { status: 422 });
  if (!UAE_CITIES.test(`${city} ${neighborhood} ${source.context}`)) return NextResponse.json({ error: "Weyn currently imports places in the UAE. Add the UAE city so I can confirm it.", needsDetails: true }, { status: 422 });

  const escaped = name.replace(/[%_]/g, "");
  const { data: matches } = await supabase.from("venues").select("*").ilike("name", `%${escaped}%`).limit(1);
  if (matches?.[0]) {
    await supabase.from("saves").upsert({ user_id: user.id, venue_id: matches[0].id });
    return NextResponse.json({ place: { ...matches[0], kind: "venue" }, matched: true, confidence });
  }
  let latitude = null, longitude = null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token) {
    const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(`${name}, ${neighborhood}, ${city}, UAE`)}&country=ae&limit=1&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) { const body = await response.json(); [longitude, latitude] = body.features?.[0]?.geometry?.coordinates || [null, null]; }
  }
  const row = { user_id: user.id, name, neighborhood: neighborhood || null, city: city || null, latitude, longitude, source_url: source.sourceUrl };
  const { data, error } = await supabase.from("personal_places").upsert(row, { onConflict: "user_id,name,city" }).select("*").single();
  if (error) return NextResponse.json({ error: "Couldn't save that place. Please try again." }, { status: 500 });
  return NextResponse.json({ place: { ...data, kind: "personal" }, matched: false, confidence });
}

