// Single source of truth for what a viewer is allowed to see.
//
// Two inputs, deliberately separate:
//   birthdate     - the hard legal limit. Cannot be widened by a preference.
//   show21Plus    - the soft preference. Can only ever narrow, never widen.
//
// UAE: drinking age is 21 in Dubai and Abu Dhabi; shisha is 18.
// Everything unknown resolves to "all-ages", so a logged-out visitor, a user
// mid-onboarding, or a failed lookup all land on the safe default rather than
// leaking licensed venues.

export const AGE_TIERS = ["all-ages", "18-plus", "21-plus"];

// Whole years elapsed, calendar-correct (no 365.25 drift on leap years).
export function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const dob = birthdate instanceof Date ? birthdate : new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age < 0 || age > 130 ? null : age;
}

// The highest age tier this viewer may see. Maps 1:1 onto the p_max_age
// argument of the get_nearby RPC, which already expands a tier into the
// full list of allowed age_restriction values.
export function maxAgeTier(profile) {
  const age = ageFromBirthdate(profile?.birthdate);
  if (age === null || age < 18) return "all-ages";
  if (age < 21) return "18-plus";
  return profile?.show_21_plus ? "21-plus" : "18-plus";
}

// Expanded list, for .in() filters against venues.age_restriction.
export function allowedAgeRestrictions(tier) {
  switch (tier) {
    case "21-plus":
      return ["all-ages", "18-plus", "21-plus"];
    case "18-plus":
      return ["all-ages", "18-plus"];
    default:
      return ["all-ages"];
  }
}

// Convenience: may this viewer see the 21+ nightlife section at all?
export function canSee21Plus(profile) {
  return maxAgeTier(profile) === "21-plus";
}

// Is this viewer old enough to be *offered* the 21+ opt-in? (Used to decide
// whether to show the preference toggle in settings at all.)
export function isAdult21(profile) {
  const age = ageFromBirthdate(profile?.birthdate);
  return age !== null && age >= 21;
}

// Has this viewer answered the age question yet?
export function hasAnsweredAge(profile) {
  return !!profile?.age_confirmed_at;
}
