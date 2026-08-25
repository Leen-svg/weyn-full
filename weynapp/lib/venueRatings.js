import { db } from "./db";

/* Attach an average review score to each venue, for the rating badge
   the venue cards show over their cover image.

   Deliberately computed from the real `reviews` table rather than
   stored on `venues`: there is no aggregate column, and a venue with
   no published reviews gets `rating: null` so the card renders no
   badge at all. A made-up or defaulted score would be worse than none,
   people act on these numbers.

   One query for the whole page, then averaged in memory. The row count
   here is small (published reviews for the handful of venues on one
   screen); if that stops being true this should become a view or a
   materialised aggregate rather than a bigger fetch. */
export async function withRatings(venues) {
  if (!venues?.length) return venues || [];

  const { data } = await db()
    .from("reviews")
    .select("venue_id, rating")
    .in(
      "venue_id",
      venues.map((v) => v.id)
    )
    .eq("status", "published");

  const totals = {};
  for (const row of data || []) {
    if (typeof row.rating !== "number") continue;
    const bucket = (totals[row.venue_id] ||= { sum: 0, count: 0 });
    bucket.sum += row.rating;
    bucket.count += 1;
  }

  return venues.map((venue) => {
    const bucket = totals[venue.id];
    return {
      ...venue,
      rating: bucket ? Math.round((bucket.sum / bucket.count) * 10) / 10 : null,
      rating_count: bucket ? bucket.count : 0,
    };
  });
}
