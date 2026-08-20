import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SOCIAL_HOSTS = new Set(["instagram.com","www.instagram.com","tiktok.com","www.tiktok.com","vm.tiktok.com"]);
function clean(v, max=160){ return String(v || "").trim().slice(0,max); }
async function socialContext(input) {
  try {
    const url = new URL(input.trim());
    if (!SOCIAL_HOSTS.has(url.hostname)) return input;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500), headers: { "user-agent": "Mozilla/5.0 WeynBot/1.0" } });
    const html = (await res.text()).slice(0, 120000);
    const bits = [...html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:title|og:description|description)["'][^>]+content=["']([^"']+)/gi)].map((m)=>m[1]);
    return `${input}\n${bits.join("\n")}`.slice(0,4000);
  } catch { return input; }
}
export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to import a place" }, { status: 401 });
  const { input } = await req.json();
  if (!clean(input, 4000)) return NextResponse.json({ error: "Paste a link or message" }, { status: 400 });
  let parsed = { name: clean(input.split(/\r?\n/)[0]), neighborhood: "", city: "Abu Dhabi" };
  if (process.env.OPENAI_API_KEY) {
    const context = await socialContext(clean(input, 4000));
    const ai = await fetch("https://api.openai.com/v1/chat/completions", { method:"POST", headers:{"content-type":"application/json",authorization:`Bearer ${process.env.OPENAI_API_KEY}`}, body:JSON.stringify({ model:"gpt-4.1-mini", temperature:0, response_format:{type:"json_object"}, messages:[{role:"system",content:"Extract one real place from UAE text. Return JSON: name, neighborhood, city. Never invent missing details."},{role:"user",content:context}] }) });
    if (ai.ok) { try { parsed = JSON.parse((await ai.json()).choices?.[0]?.message?.content || "{}"); } catch {} }
  }
  const name = clean(parsed.name); const city = clean(parsed.city || "Abu Dhabi", 80); const neighborhood = clean(parsed.neighborhood, 120);
  if (!name) return NextResponse.json({ error: "I couldn't find a place name. Paste the caption or WhatsApp text too." }, { status: 422 });
  const { data: matches } = await supabase.from("venues").select("*").ilike("name", `%${name.replace(/[%_]/g, "")}%`).limit(1);
  if (matches?.[0]) { await supabase.from("saves").insert({ user_id:user.id, venue_id:matches[0].id }); return NextResponse.json({ place:{...matches[0],kind:"venue"}, matched:true }); }
  let latitude=null, longitude=null;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token) { const geo=await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(`${name}, ${neighborhood}, ${city}, UAE`)}&country=ae&limit=1&access_token=${encodeURIComponent(token)}`); if(geo.ok){const j=await geo.json(); [longitude,latitude]=j.features?.[0]?.geometry?.coordinates || [null,null];} }
  const row={user_id:user.id,name,neighborhood:neighborhood||null,city:city||null,latitude,longitude,source_url:/^https?:\/\//i.test(clean(input))?clean(input,1000):null};
  const { data, error }=await supabase.from("personal_places").upsert(row,{onConflict:"user_id,name,city"}).select("*").single();
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({place:{...data,kind:"personal"},matched:false});
}
