import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const alt = "A shared Weyn place list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const service = db();
  const { data: board } = await service.from("trip_boards").select("id,title").eq("share_slug", slug).eq("is_public", true).maybeSingle();
  const { data: rows } = board ? await service.from("trip_board_places").select("venues(name),personal_places(name)").eq("board_id", board.id).order("position").limit(3) : { data: [] };
  const names = (rows || []).map((row) => row.venues?.name || row.personal_places?.name).filter(Boolean);
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 70, background: "linear-gradient(135deg,#edf8ff,#fff5d9 55%,#ffe8f0)", color: "#182a43", fontFamily: "Arial" }}><div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>WEYN · SHARED LIST</div><div style={{ display: "flex", flexDirection: "column" }}><div style={{ display: "flex", fontSize: 72, fontWeight: 900, letterSpacing: -3 }}>{board?.title || "A Weyn list"}</div><div style={{ display: "flex", marginTop: 28, fontSize: 30 }}>{names.length ? names.join("  ·  ") : "Open the list to see every place"}</div></div><div style={{ display: "flex", fontSize: 26 }}>Open anywhere. No download needed.</div></div>, size);
}
