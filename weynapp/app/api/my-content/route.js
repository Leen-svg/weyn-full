import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req) {
  const supabase = await createClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to manage your content" }, { status: 401 });

  const [{ data: posts, error: postError }, { data: reviews, error: reviewError }] = await Promise.all([
    supabase.from("posts")
      .select("id,body,visibility,status,archived_at,created_at,venues(name),saved_lists(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("reviews")
      .select("id,body,rating,visibility,status,archived_at,created_at,venues(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (postError || reviewError) return NextResponse.json({ error: postError?.message || reviewError?.message }, { status: 500 });
  return NextResponse.json({ posts: posts || [], reviews: reviews || [] });
}
