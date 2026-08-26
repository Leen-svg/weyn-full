function normalized(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

const INTENTS = [
  { triggers: ["rooftop", "roof top", "skyline"], tags: ["rooftop", "rooftop views", "views"] },
  { triggers: ["quiet", "peaceful", "calm", "conversation"], tags: ["quiet", "intimate", "cozy casual", "hidden gem"] },
  { triggers: ["date", "romantic", "anniversary"], tags: ["date night", "romantic", "intimate"] },
  { triggers: ["brunch", "breakfast"], tags: ["brunch", "breakfast"] },
  { triggers: ["coffee", "cafe", "café"], tags: ["specialty coffee", "coffee", "cafe"] },
  { triggers: ["shisha", "hookah"], tags: ["shisha served", "shisha"] },
  { triggers: ["beach", "seaside", "sea view", "waterfront"], tags: ["beach", "waterfront", "sea view"] },
  { triggers: ["outside", "outdoor", "terrace", "garden"], tags: ["outdoor", "terrace", "garden"] },
  { triggers: ["late night", "after midnight", "open late"], tags: ["late night", "open late"] },
  { triggers: ["family", "kids", "children"], tags: ["family", "all ages welcome", "kids"] },
  { triggers: ["hidden gem", "underrated", "not touristy"], tags: ["hidden gem"] },
  { triggers: ["food", "restaurant", "dinner", "lunch"], tags: ["foodie approved", "dining"] },
  { triggers: ["drinks", "cocktail", "bar", "wine", "alcohol"], tags: ["licensed serves alcohol", "licensed", "cocktails"] },
  { triggers: ["party", "dance", "dancing", "club"], tags: ["loud theatrical", "lively", "dance"] },
  { triggers: ["walk in", "last minute", "no booking"], tags: ["walk ins welcome", "walk in"] },
  { triggers: ["aesthetic", "instagrammable", "pretty", "photo"], tags: ["aesthetic focused", "aesthetic"] },
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

