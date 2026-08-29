import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { withCovers, withCoordinates } from "@/lib/venueMedia";
import { cleanStringList, payloadTooLarge, validCoordinates } from "@/lib/request-security.mjs";
import { rateLimit } from "@/lib/request-security";
import { mergeVenueResults, shortlistResultNote } from "@/lib/shortlist-utils.mjs";
import { viewerAccess } from "@/lib/session";
import { AGE_TIERS } from "@/lib/age";

const ALLOWED_AGES = new Set(AGE_TIERS);

// The request may ask for a narrower tier than the viewer is entitled to
// (a 21+ user browsing all-ages), but never a wider one. Whatever the body
// says, the ceiling is the viewer's own tier.
function clampAge(requested, viewerTier) {
  const asked = ALLOWED_AGES.has(requested) ? requested : "all-ages";
  return AGE_TIERS.indexOf(asked) <= AGE_TIERS.indexOf(viewerTier) ? asked : viewerTier;
}

export async function POST(req) {
  if (payloadTooLarge(req, 16 * 1024)) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const limited = await rateLimit(req, "shortlist", 120, 60 * 60);
  if (!limited.allowed) return NextResponse.json({ error: "Too many searches. Try again later." }, { status: 429 });
  const { tags, maxSpend, aestheticOnly, zones, maxAge, city, nearby } = await req.json();
  const safeTags = cleanStringList(tags);
  const safeZones = cleanStringList(zones);
  if (safeTags.length === 0) {
    return NextResponse.json({ error: "Pick at least one tag" }, { status: 400 });
  }

  const { tier } = await viewerAccess();
  const safeAge = clampAge(maxAge, tier);
  const safeCity = city === "Dubai" ? "Dubai" : "Abu Dhabi";
  const safeSpend = Number.isFinite(Number(maxSpend)) ? Math.max(0, Math.min(100000, Number(maxSpend))) : 99999;
  const nearbyRequested = nearby && typeof nearby === "object";
  const lat = Number(nearby?.lat);
  const lng = Number(nearby?.lng);
  const radiusKm = Math.max(1, Math.min(50, Number(nearby?.radiusKm) || 15));

  if (nearbyRequested && !validCoordinates(lat, lng)) {
    return NextResponse.json({ error: "A valid location is required for Near me" }, { status: 400 });
  }

  const sharedParams = {
    p_tag_slugs: safeTags,
    p_max_spend: safeSpend,
    p_aesthetic_only: !!aestheticOnly,
    p_zone_slugs: safeZones.length ? safeZones : null,
    p_max_age: safeAge,
    p_city: safeCity,
  };

  const rpcName = nearbyRequested ? "get_shortlist_nearby" : "get_shortlist";
  const nearbyParams = nearbyRequested ? { p_lat: lat, p_lng: lng, p_radius_km: radiusKm } : {};
  const runShortlist = ({ random = false, excludeIds = [], limit = 3 } = {}) => db().rpc(rpcName, {
    ...sharedParams,
    ...nearbyParams,
    p_random: random,
    p_exclude_ids: excludeIds,
    p_limit: limit,
  });

  const { data, error } = await runShortlist();
  if (error) return NextResponse.json({ error: "Couldn't build a shortlist" }, { status: 500 });

  const exact = data || [];
  let fallback = [];
  if (exact.length < 3) {
    // The previous fallback re-ran with the SAME tag list, only randomised, so
    // a combination that matched nothing simply returned nothing twice. A
    // richer sentence through Ask Weyn therefore reliably produced zero spots.
    // Relax the vibe tags one at a time instead, keeping the constraints the
    // result note promises to keep: city, budget, age, aesthetic and Near me.
    for (let keep = safeTags.length - 1; keep >= 0; keep -= 1) {
      const needed = 3 - exact.length - fallback.length;
      if (needed <= 0) break;
      const excludeIds = [...exact, ...fallback].map((venue) => venue.id);
      const { data: relaxed, error: relaxedError } = await db().rpc(rpcName, {
        ...sharedParams,
        p_tag_slugs: safeTags.slice(0, keep),
        ...nearbyParams,
        p_random: true,
        p_exclude_ids: excludeIds,
        p_limit: needed,
      });
      if (!relaxedError && relaxed?.length) fallback = fallback.concat(relaxed);
    }
  }

  // Last resort: lift the budget. Abu Dhabi's cheapest place is 175 AED, so
  // "under 150" there can never match anything however far the tags relax —
  // the search would return nothing at all rather than something useful.
  let budgetLifted = false;
  if (exact.length + fallback.length === 0 && safeSpend < 100000) {
    const { data: anySpend, error: anySpendError } = await db().rpc(rpcName, {
      ...sharedParams,
      p_tag_slugs: [],
      p_max_spend: 99999,
      ...nearbyParams,
      p_random: true,
      p_exclude_ids: [],
      p_limit: 3,
    });
    if (!anySpendError && anySpend?.length) {
      fallback = anySpend;
      budgetLifted = true;
    }
  }

  const venues = mergeVenueResults(exact, fallback, 3);
  const relaxedCount = Math.max(0, venues.length - exact.length);
  return NextResponse.json({
    venues: await withCoordinates(await withCovers(venues)),
    relaxed: relaxedCount > 0,
    budgetLifted,
    note: shortlistResultNote({ total: venues.length, relaxedCount, nearby: nearbyRequested, budgetLifted, maxSpend: safeSpend }),
  });
}
