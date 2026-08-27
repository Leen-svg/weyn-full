export default function manifest() {
  return {
    name: "Weyn — decide where to go",
    short_name: "Weyn",
    description: "Three curated spots and one quick group vote.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F2F2F3",
    theme_color: "#17181C",
    orientation: "portrait-primary",
    // Installed-app icons are the rounded-square wordmark. The circular W is
    // the desktop browser-tab favicon and is deliberately not used here.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
