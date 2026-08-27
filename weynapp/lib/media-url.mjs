const DIRECT_VIDEO_PATTERN = /\.(?:mp4|webm|mov|m4v|ogv)(?:$|[?#])/i;

export function normalizeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseUrlList(value, max = 40) {
  const unique = [];
  const seen = new Set();
  for (const line of String(value || "").split(/\r?\n/)) {
    const url = normalizeHttpUrl(line);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(url);
    if (unique.length >= max) break;
  }
  return unique;
}

function youtubeId(parsed) {
  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || null;
  if (!["youtube.com", "youtube-nocookie.com"].includes(host)) return null;
  if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
  const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
  return match?.[1] || null;
}

export function videoPresentation(value) {
  const url = normalizeHttpUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  const yt = youtubeId(parsed);
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return { kind: "embed", provider: "YouTube", src: `https://www.youtube-nocookie.com/embed/${yt}?playsinline=1&rel=0`, url };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parsed.pathname.match(/(?:video\/)?(\d+)/)?.[1];
    if (id) return { kind: "embed", provider: "Vimeo", src: `https://player.vimeo.com/video/${id}`, url };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const id = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
    if (id) return { kind: "embed", provider: "TikTok", src: `https://www.tiktok.com/player/v1/${id}?autoplay=0`, url };
  }
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    const match = parsed.pathname.match(/^\/(p|reel|tv)\/([^/?#]+)/);
    if (match) return { kind: "embed", provider: "Instagram", src: `https://www.instagram.com/${match[1]}/${match[2]}/embed/`, url };
  }
  if (DIRECT_VIDEO_PATTERN.test(url)) return { kind: "direct", provider: "Video", src: url, url };
  return { kind: "embed", provider: host, src: url, url };
}

// Google Places photo URLs carry their size in a trailing parameter, e.g.
// "=s4800-w1400". Whatever width is baked in is the ceiling — the CDN will not
// return more than you ask for, so a 1400px source is all next/image ever has
// to work from, and on a retina phone or a wide desktop slide that is already
// being upscaled before it reaches the screen. Asking for a larger source
// costs the visitor nothing: next/image fetches it once on the server, caches
// it, and still ships a per-breakpoint variant to the browser.
const GOOGLE_PHOTO_HOST = /^lh\d+\.googleusercontent\.com$/;

export function highResPhoto(url, minWidth = 2048) {
  if (!url) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!GOOGLE_PHOTO_HOST.test(parsed.hostname)) return url;

  // The size parameter is the last "=..." segment of the path.
  const match = parsed.pathname.match(/=([^/]*)$/);
  if (!match) return url;

  const spec = match[1];
  const w = Number(spec.match(/(?:^|-)w(\d+)/)?.[1] || 0);
  const h = Number(spec.match(/(?:^|-)h(\d+)/)?.[1] || 0);
  if (!w || w >= minWidth) return url;

  // Both dimensions have to scale by the same factor. Raising only the width
  // on a "=w408-h306-k-no" thumbnail asks the CDN for a 2048x306 sliver.
  const factor = minWidth / w;
  let next = spec.replace(/((?:^|-))w\d+/, `$1w${minWidth}`);
  if (h) next = next.replace(/((?:^|-))h\d+/, `$1h${Math.round(h * factor)}`);

  parsed.pathname = parsed.pathname.slice(0, match.index) + "=" + next;
  return parsed.toString();
}
