import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { contentAccountError } from "@/lib/content-safety";
import { payloadTooLarge } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { extractFirstHttpUrl, extractPlaceDetails, isUaeLocation } from "@/lib/place-import.mjs";

const SOCIAL_HOSTS = new Set(["instagram.com", "www.instagram.com", "tiktok.com", "www.tiktok.com", "vm.tiktok.com"]);
const MAP_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "google.com", "www.google.com", "maps.google.com", "maps.apple.com"]);
function clean(value, max = 160) { return String(value || "").trim().slice(0, max); }
function parsedUrl(value) { try { const url = new URL(value.trim()); return url.protocol === "https:" || url.protocol === "http:" ? url : null; } catch { return null; } }

function pageMetadata(html) {
  return [...String(html || "").matchAll(/<meta\b[^>]*>/gi)].flatMap(([tag]) => {
    const key = /(?:property|name)=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const value = /content=["']([^"']+)["']/i.exec(tag)?.[1];
    return key && value && ["og:title", "og:description", "description"].includes(key) ? [value] : [];
  });
}

async function sourceContext(input) {
  const rawUrl = extractFirstHttpUrl(input);
  const url = parsedUrl(rawUrl || "");
  if (!url || (!SOCIAL_HOSTS.has(url.hostname) && !MAP_HOSTS.has(url.hostname))) {
    return { context: input, socialOnly: false, social: false, sourceUrl: url?.href || null };
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4500), headers: { "user-agent": "Mozilla/5.0 WeynBot/1.0" } });
    const html = (await response.text()).slice(0, 120000);
    const bits = pageMetadata(html);
    const social = SOCIAL_HOSTS.has(url.hostname);
    const onlyUrl = input.replace(rawUrl, "").trim().length === 0;
    return {
      context: `${input}\n${bits.join("\n")}`.slice(0, 4000),
      socialOnly: social && onlyUrl && bits.length === 0,
      social,
      sourceUrl: response.url || url.href,
    };
  } catch {
    const social = SOCIAL_HOSTS.has(url.hostname);
    return { context: input, socialOnly: social && input.replace(rawUrl, "").trim().length === 0, social, sourceUrl: url.href };
  }
}

async function geocodeUae(name, neighborhood, city) {
  const query = `${name}, ${neighborhood || ""}, ${city || ""}, UAE`;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token) {
    try {
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&country=ae&limit=1&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const body = await response.json();
        const [longitude, latitude] = body.features?.[0]?.geometry?.coordinates || [null, null];
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
      }
    } catch {}
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ae&limit=1&q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "Weyn/1.0 (https://goweyn.ae/contact)", "accept-language": "en" },
    });
    if (response.ok) {
      const result = (await response.json())?.[0];
      const latitude = Number(result?.lat), longitude = Number(result?.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
    }
  } catch {}
  return { latitude: null, longitude: null };
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

  const source = await sourceContext(raw);
  if (source.socialOnly) return NextResponse.json({ error: "That social app hid the place details. Paste the caption or add the place name and UAE city beside the link.", needsDetails: true }, { status: 422 });
  const extracted = extractPlaceDetails(source.context, source.sourceUrl);
  let aiParsed = {};
  if (process.env.OPENAI_API_KEY) {
    try {
      const ai = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(8000), headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Extract one real UAE place. Return JSON with name, neighborhood, city, confidence (0-1). Never invent missing details. Return an empty name if uncertain." }, { role: "user", content: source.context }] }) });
      if (ai.ok) aiParsed = JSON.parse((await ai.json()).choices?.[0]?.message?.content || "{}");
    } catch {}
  }
  const name = clean(aiParsed.name || extracted.name);
  const city = clean(aiParsed.city || extracted.city, 80);
  const neighborhood = clean(aiParsed.neighborhood || extracted.neighborhood, 120);
  const confidence = Math.max(0, Math.min(1, Number(aiParsed.confidence ?? (name ? 0.65 : 0))));
  if (!name) return NextResponse.json({ error: "I couldn't confidently find a place name. Add the place name and UAE city, then try again.", needsDetails: true }, { status: 422 });

  const escaped = name.split(",")[0].replace(/[%_]/g, "").trim();
  const { data: matches } = await supabase.from("venues").select("*").ilike("name", `%${escaped}%`).limit(1);
  if (matches?.[0]) {
    await supabase.from("saves").upsert({ user_id: user.id, venue_id: matches[0].id });
    return NextResponse.json({ place: { ...matches[0], kind: "venue" }, matched: true, confidence });
  }
  if (!isUaeLocation({ city, latitude: extracted.latitude, longitude: extracted.longitude }, source.context)) return NextResponse.json({ error: "Weyn currently imports places in the UAE. Add the UAE city so I can confirm it.", needsDetails: true }, { status: 422 });
  let latitude = extracted.latitude, longitude = extracted.longitude;
  if (latitude === null || longitude === null) ({ latitude, longitude } = await geocodeUae(name, neighborhood, city));
  const row = { user_id: user.id, name, neighborhood: neighborhood || null, city: city || null, latitude, longitude, source_url: source.sourceUrl };
  const { data, error } = await supabase.from("personal_places").upsert(row, { onConflict: "user_id,name,city" }).select("*").single();
  if (error) return NextResponse.json({ error: "Couldn't save that place. Please try again." }, { status: 500 });
  return NextResponse.json({ place: { ...data, kind: "personal" }, matched: false, confidence });
}

