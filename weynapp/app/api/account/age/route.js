import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/request-security";
import { ageFromBirthdate, isAdult21, maxAgeTier } from "@/lib/age";

// The age gate is written server-side with the service-role key on purpose:
// `profiles` has no user-facing UPDATE policy, so a client cannot backdate
// itself into the 21+ tier. The preference is also clamped here rather than
// trusted from the request body.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const limited = await rateLimit(req, "set-age", 10, 60 * 60, user.id);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const birthdate = String(body.birthdate || "").trim();
  if (!ISO_DATE.test(birthdate)) {
    return NextResponse.json({ error: "Enter your date of birth" }, { status: 400 });
  }
  const age = ageFromBirthdate(birthdate);
  if (age === null) return NextResponse.json({ error: "That date doesn't look right" }, { status: 400 });
  if (age < 0 || age > 120) return NextResponse.json({ error: "That date doesn't look right" }, { status: 400 });

  // A user under 21 cannot opt in, whatever the request body says.
  const wants21 = body.show21Plus === true;
  const show_21_plus = wants21 && age >= 21;

  const s = db();
  const { error } = await s
    .from("profiles")
    .update({
      birthdate,
      age_confirmed_at: new Date().toISOString(),
      show_21_plus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const profile = { birthdate, show_21_plus };
  return NextResponse.json({
    ok: true,
    age,
    show21Plus: show_21_plus,
    eligibleFor21Plus: isAdult21(profile),
    tier: maxAgeTier(profile),
  });
}

// Toggling the preference later (from profile settings) without re-entering a DOB.
export async function PATCH(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const limited = await rateLimit(req, "set-age-pref", 30, 60 * 60, user.id);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.show21Plus !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const s = db();
  const { data: profile } = await s.from("profiles").select("birthdate").eq("id", user.id).maybeSingle();
  if (!profile?.birthdate) {
    return NextResponse.json({ error: "Confirm your date of birth first" }, { status: 400 });
  }
  if (body.show21Plus && !isAdult21(profile)) {
    return NextResponse.json({ error: "You must be 21 or over for this" }, { status: 403 });
  }

  const { error } = await s
    .from("profiles")
    .update({ show_21_plus: body.show21Plus, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    show21Plus: body.show21Plus,
    tier: maxAgeTier({ ...profile, show_21_plus: body.show21Plus }),
  });
}
