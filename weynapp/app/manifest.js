export default function manifest() {
  return {
    name: "Weyn — decide where to go",
    short_name: "Weyn",
    description: "Three curated spots and one quick group vote.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F1EEFA",
    theme_color: "#7C3AED",
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

