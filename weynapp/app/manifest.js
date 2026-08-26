export default function manifest() {
  return {
    name: "Weyn — decide where to go",
    short_name: "Weyn",
    description: "Three curated spots and one quick group vote.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F9F9F9",
    theme_color: "#8E7CE8",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}


