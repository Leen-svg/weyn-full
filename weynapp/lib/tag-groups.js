// Shared ordering for vibe tag categories.
//
// "Access & Rules" is housekeeping (age limits, dress codes) rather than a
// vibe, so it belongs at the bottom of every picker. This lived only in
// VibeSelector before, which is why the profile editor still led with it.

export function isAccessRules(category) {
  return (
    category?.slug === "access-rules" ||
    category?.name?.trim().toLowerCase() === "access & rules"
  );
}

// The 21+ tag ships from two sources and rendered twice in the picker.
export function isDuplicateAgeTag(tag) {
  return tag?.slug === "21-plus" || tag?.display_name?.trim() === "21+";
}

export function orderTagGroups(groups) {
  return [...(groups || [])].sort(
    (a, b) => Number(isAccessRules(a)) - Number(isAccessRules(b)),
  );
}

// Keeps the first of any repeated tag, so 21+ renders once.
export function dedupeTags(tags) {
  const seen = new Set();
  return (tags || []).filter((t) => {
    const key = t?.slug || t?.display_name?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
