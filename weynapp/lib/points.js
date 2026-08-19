import { db } from "./db";

export const POINTS = {
  signup_bonus: 200,
  rated_a_place: 15,
  tried_new_place: 25,
  shared_a_spot: 10,
  new_person: 15,
  suggested_a_place: 10,
  suggested_a_tag_fix: 5,
  viewed_ratings: 2,
  posted: 8,
};

// Writes the ledger row and updates the balance atomically via the
// award_points() SQL function (service-role only).
export async function awardPoints(userId, delta, reason) {
  if (!userId || !delta) return;
  await db().rpc("award_points", { p_user_id: userId, p_delta: delta, p_reason: reason });
}
