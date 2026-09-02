const INSTAGRAM_POST = /https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i;

// Instagram's copied embed snippet contains script and blockquote markup. We
// never store or render that HTML: only extract its public post permalink.
export function extractInstagramPostUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const decoded = value
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");
  const match = decoded.match(INSTAGRAM_POST);
  if (!match) return null;
  return `https://www.instagram.com/${match[1].toLowerCase()}/${match[2]}/`;
}

export function instagramEmbedUrl(value) {
  const permalink = extractInstagramPostUrl(value);
  return permalink ? `${permalink}embed/captioned/` : null;
}
