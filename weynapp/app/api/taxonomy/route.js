import { NextResponse } from "next/server";
import { getTaxonomy } from "@/lib/taxonomy";

export async function GET() {
  const { groups } = await getTaxonomy();
  return NextResponse.json({ groups });
}
