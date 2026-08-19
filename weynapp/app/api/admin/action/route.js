import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind, id, action } = await req.json();
  const s = db();
  const now = new Date().toISOString();

  try {
    // ---- Venue submissions ----
    if (kind === "submission") {
      const { data: sub } = await s.from("venue_submissions").select("*").eq("id", id).single();
      if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (action === "approve") {
        const { data: venue, error } = await s.from("venues").insert({
          name: sub.name,
          zone_slug: sub.zone_slug,
          neighborhood: sub.neighborhood || "",
          google_maps_url: sub.google_maps_url,
          avg_spend_aed: sub.avg_spend_aed ?? 0,
          is_aesthetic: false,
          source_creator: sub.submitter_handle,
          note_to_self: sub.why_love,
        }).select("id").single();
        if (error) throw error;

        const slugs = [sub.energy_tag, ...(sub.activity_tags || []), ...(sub.occasion_tags || [])].filter(Boolean);
        if (slugs.length) {
          const { data: tags } = await s.from("vibe_tags").select("id, slug").in("slug", slugs);
          if (tags?.length) {
            await s.from("venue_tags").insert(tags.map((t) => ({ venue_id: venue.id, tag_id: t.id })));
          }
        }
        await s.from("venue_submissions").update({ status: "approved", approved_venue_id: venue.id, reviewed_at: now }).eq("id", id);
      } else {
        await s.from("venue_submissions").update({ status: action === "duplicate" ? "duplicate" : "rejected", reviewed_at: now }).eq("id", id);
      }
    }

    // ---- Tag votes ----
    else if (kind === "tagvote") {
      const { data: vote } = await s.from("tag_votes").select("*").eq("id", id).single();
      if (!vote) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (action === "apply") {
        if (vote.vote === "wrong_tag" && vote.tag_slug) {
          const { data: tag } = await s.from("vibe_tags").select("id").eq("slug", vote.tag_slug).single();
          if (tag) await s.from("venue_tags").delete().eq("venue_id", vote.venue_id).eq("tag_id", tag.id);
        }
        if (vote.vote === "missing_tag" && vote.suggested_tag_slug) {
          const { data: tag } = await s.from("vibe_tags").select("id").eq("slug", vote.suggested_tag_slug).single();
          if (tag) await s.from("venue_tags").upsert({ venue_id: vote.venue_id, tag_id: tag.id }, { onConflict: "venue_id,tag_id" });
        }
        await s.from("tag_votes").update({ status: "applied" }).eq("id", id);
      } else {
        await s.from("tag_votes").update({ status: "dismissed" }).eq("id", id);
      }
    }

    // ---- Video submissions ----
    else if (kind === "video") {
      const { data: vid } = await s.from("video_submissions").select("*").eq("id", id).single();
      if (!vid) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (action === "approve") {
        if (vid.venue_id) {
          await s.from("venues").update({ hero_video_url: vid.tiktok_url, source_creator: vid.creator_handle }).eq("id", vid.venue_id);
        }
        await s.from("video_submissions").update({ status: "approved", reviewed_at: now }).eq("id", id);
      } else if (action === "remove") {
        if (vid.venue_id) {
          const { data: v } = await s.from("venues").select("hero_video_url").eq("id", vid.venue_id).single();
          if (v?.hero_video_url === vid.tiktok_url) {
            await s.from("venues").update({ hero_video_url: null }).eq("id", vid.venue_id);
          }
        }
        await s.from("video_submissions").update({ status: "removed", reviewed_at: now }).eq("id", id);
      } else {
        await s.from("video_submissions").update({ status: "rejected", reviewed_at: now }).eq("id", id);
      }
    }

    // ---- Takedown requests ----
    else if (kind === "takedown") {
      const { data: tr } = await s.from("takedown_requests").select("*").eq("id", id).single();
      if (!tr) return NextResponse.json({ error: "Not found" }, { status: 404 });

      if (action === "complete") {
        // pull the video everywhere it appears
        await s.from("venues").update({ hero_video_url: null }).eq("hero_video_url", tr.video_url);
        await s.from("video_submissions").update({ status: "removed", reviewed_at: now }).eq("tiktok_url", tr.video_url);
        await s.from("takedown_requests").update({ status: "completed", reviewed_at: now }).eq("id", id);
      } else {
        await s.from("takedown_requests").update({ status: "rejected", reviewed_at: now }).eq("id", id);
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
