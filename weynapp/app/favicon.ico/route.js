const ICON = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
  '<rect width="64" height="64" rx="16" fill="#1F3044"/>',
  '<circle cx="50" cy="14" r="13" fill="#8E7CE8" opacity=".95"/>',
  '<circle cx="13" cy="52" r="12" fill="#FFE45E" opacity=".94"/>',
  '<path d="M14 21 21 43 31 28 41 43 50 21" fill="none" stroke="#F9F9F9" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
  '<circle cx="52" cy="48" r="5" fill="#FF6392"/>',
  "</svg>",
].join("");

export function GET() {
  return new Response(ICON, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}


