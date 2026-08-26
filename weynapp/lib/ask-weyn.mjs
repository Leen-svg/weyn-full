function normalized(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

// Every `tags` entry below must resolve against the live taxonomy, which is a
// fixed set of 32 vibe tags. The previous list was written against invented
// names ("rooftop", "specialty coffee", "brunch"), only 3 of which existed, so
// almost every phrase resolved to nothing and Ask Weyn answered "try a little
// more detail". Candidates are real slugs, most specific first.
const INTENTS = [
  // Vibe & noise
  { triggers: ["quiet", "peaceful", "calm", "conversation", "talk", "chat", "catch up"], tags: ["conversation-friendly"] },
  { triggers: ["cozy", "cosy", "casual", "chill", "relaxed", "laid back", "low key"], tags: ["cozy-and-casual"] },
  { triggers: ["moody", "dark", "intimate", "dimly lit", "candlelit", "speakeasy"], tags: ["dark-and-moody"] },
  { triggers: ["party", "loud", "lively", "dance", "dancing", "club", "buzzing", "energetic", "night out"], tags: ["loud-and-theatrical"] },
  { triggers: ["aesthetic", "instagrammable", "instagram", "pretty", "photo", "photogenic", "cute"], tags: ["aesthetic-instagrammable"] },
  { triggers: ["for the gram", "content", "photoshoot"], tags: ["do-it-for-the-gram"] },

  // Occasion
  { triggers: ["date", "romantic", "anniversary", "valentine"], tags: ["date-night"] },
  { triggers: ["birthday", "celebration", "big group", "large group", "group dinner", "party of"], tags: ["big-group-celebration"] },
  { triggers: ["business", "client", "meeting", "work dinner", "professional", "impress"], tags: ["business-impress-a-client"] },
  { triggers: ["solo", "alone", "by myself", "me time", "on my own"], tags: ["solo-escape"] },
  { triggers: ["quick", "fast", "short", "grab a", "in and out"], tags: ["quick-catchup"] },
  { triggers: ["sundowner", "sunset", "golden hour", "weekend", "friday"], tags: ["weekend-sundowners"] },
  { triggers: ["late night", "after midnight", "open late", "midnight", "3am", "2am"], tags: ["late-night-dining", "late-night-bites"] },

  // Substance & value
  { triggers: ["food", "restaurant", "dinner", "lunch", "eat", "foodie", "good food", "tasty"], tags: ["foodie-approved"] },
  { triggers: ["hungry", "big portions", "generous", "filling", "value for money", "cheap eats"], tags: ["generous-portions"] },
  { triggers: ["hidden gem", "underrated", "not touristy", "local spot", "off the beaten"], tags: ["hidden-gem"] },
  { triggers: ["touristy", "famous", "landmark", "iconic", "must see"], tags: ["tourist-staple"] },
  { triggers: ["brunch", "breakfast", "coffee", "cafe"], tags: ["foodie-approved", "cozy-and-casual"] },

  // Climate & seating
  { triggers: ["outside", "outdoor", "terrace", "garden", "al fresco", "open air"], tags: ["ac-cooled-outdoor-terrace"] },
  { triggers: ["indoor", "inside", "air conditioned", "aircon", "ac", "escape the heat"], tags: ["indoor-only"] },
  { triggers: ["rooftop", "roof top", "skyline", "view", "views", "sea view", "marina", "waterfront", "beach", "seaside"], tags: ["sea-marina-view"] },

  // Access & rules
  { triggers: ["drinks", "cocktail", "cocktails", "bar", "wine", "alcohol", "beer", "licensed"], tags: ["licensed-serves-alcohol"] },
  { triggers: ["no alcohol", "dry", "alcohol free", "unlicensed", "halal"], tags: ["dry-unlicensed"] },
  { triggers: ["shisha", "hookah", "smoke"], tags: ["shisha-served"] },
  { triggers: ["family", "kids", "children", "all ages", "family friendly"], tags: ["all-ages-welcome"] },
  { triggers: ["21+", "adults only", "over 21", "no kids"], tags: ["strictly-21plus"] },

  // Logistics & lifestyle
  { triggers: ["walk in", "walk ins", "last minute", "no booking", "spontaneous"], tags: ["walk-ins-welcome"] },
  { triggers: ["booking", "reserve", "reservation", "book a table"], tags: ["reservation-essential"] },
  { triggers: ["parking", "valet", "easy parking", "drive"], tags: ["free-valet-dedicated-parking"] },
  { triggers: ["work", "laptop", "study", "wifi", "remote", "co working"], tags: ["laptop-work-friendly"] },
  { triggers: ["pet", "dog", "dogs", "pet friendly"], tags: ["pet-friendly"] },
];

function includesPhrase(haystack, phrase) {
  const clean = normalized(phrase);
  return clean && (` ${haystack} `).includes(` ${clean} `);
}

function bestTagForCandidates(tags, candidates) {
  for (const candidate of candidates) {
    const needle = normalized(candidate);
    const exact = tags.find((tag) => normalized(tag.slug) === needle || normalized(tag.display_name) === needle);
    if (exact) return exact;
    const partial = tags.find((tag) => {
      const searchable = normalized(`${tag.slug} ${tag.display_name}`);
      return searchable.includes(needle) || (needle.length > 4 && needle.includes(normalized(tag.display_name)));
    });
    if (partial) return partial;
  }
  return null;
}

export function interpretAskWeyn(query, groups = [], defaults = {}) {
  const q = normalized(query);
  const allTags = groups.flatMap((group) => (group.tags || []).map((tag) => ({ ...tag, categorySlug: group.slug })));
  const picked = [];
  const seen = new Set();
  const add = (tag) => {
    if (!tag || seen.has(tag.slug)) return;
    seen.add(tag.slug);
    picked.push(tag);
  };

  // A tag's full label in the sentence is the strongest possible signal.
  allTags.forEach((tag) => {
    const label = normalized(tag.display_name);
    if (label.length >= 4 && includesPhrase(q, label)) add(tag);
  });

  INTENTS.forEach((intent) => {
    if (intent.triggers.some((trigger) => includesPhrase(q, trigger))) {
      add(bestTagForCandidates(allTags, intent.tags));
    }
  });

  const selected = {};
  groups.forEach((group) => {
    const limit = Math.max(1, Number(group.max_select) || 1);
    const matches = picked.filter((tag) => tag.categorySlug === group.slug).slice(0, limit);
    if (matches.length) selected[group.slug] = matches.map((tag) => tag.slug);
  });

  let city = defaults.city || "Abu Dhabi";
  if (/\bdubai\b/.test(q)) city = "Dubai";
  else if (/\babu dhabi\b|\bad\b/.test(q)) city = "Abu Dhabi";

  let maxSpend = Number(defaults.maxSpend) || 99999;
  const budgetMatch = q.match(/(?:under|below|less than|max(?:imum)?|up to)\s*(\d{1,5})|(?:aed|dhs?)\s*(\d{1,5})|(\d{1,5})\s*(?:aed|dhs?)/);
  if (budgetMatch) maxSpend = Math.max(1, Math.min(100000, Number(budgetMatch[1] || budgetMatch[2] || budgetMatch[3])));
  else if (/\bcheap\b|\bbudget\b|\baffordable\b/.test(q)) maxSpend = 100;

  let maxAge = defaults.maxAge || "all-ages";
  if (/\b21\s*\+|over 21|adults only/.test(q)) maxAge = "21-plus";
  else if (/\b18\s*\+|over 18/.test(q)) maxAge = "18-plus";
  else if (/all ages|family|kids|children/.test(q)) maxAge = "all-ages";

  const aestheticOnly = /\baesthetic\b|instagrammable|photo worthy|photogenic/.test(q)
    ? true
    : !!defaults.aestheticOnly;

  const tags = Object.values(selected).flat();
  return { selected, tags, city, maxSpend, maxAge, aestheticOnly };
}

