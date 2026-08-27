import { db } from "./db";

export const POINTS = {
  signup_bonus: 200,
  checked_in: 20,
  rated_a_place: 15,
  shared_a_spot: 10,
  new_person: 5,
  suggested_a_place: 10,
  suggested_a_tag_fix: 5,
  viewed_ratings: 2,
};

// Writes the ledger row and updates the balance atomically via the
// award_points() SQL function (service-role only).
//
// Returns whether the points actually landed. The result used to be thrown
// away, so a failed award — a rotated service key, a changed function, the
// database refusing the call — left the caller telling someone they had
// earned points that were never credited, with nothing in the logs to say so.
// Callers that ignore the return value behave exactly as before.
export async function awardPoints(userId, delta, reason) {
  if (!userId || !delta) return false;
  const { error } = await db().rpc("award_points", {
    p_user_id: userId,
    p_delta: delta,
    p_reason: reason,
  });
  if (error) {
    console.error(`awardPoints failed (${reason}, ${delta} to ${userId}):`, error.message);
    return false;
  }
  return true;
}


