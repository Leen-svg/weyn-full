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
