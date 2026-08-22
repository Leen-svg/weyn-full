import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/request-security";

export async function DELETE(req) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  const limited = await rateLimit(req, "delete-account", 3, 60 * 60, user.id);
  if (!limited.allowed) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const { error } = await db().auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
