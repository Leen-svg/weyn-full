/** @type {import('next').NextConfig} */
const nextConfig = {
  // Venue photography is served from Google Places; user uploads come from
  // Supabase storage. Listing the two hosts explicitly lets next/image
  // optimise them — AVIF/WebP, per-breakpoint resizing and long-lived
  // caching — instead of shipping the full-size original to every device.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return {
      // beforeFiles runs ahead of the app router, so the static marketing
      // site in /public wins for these paths. Everything else falls through
      // to the Next app: /app, /find, /groups, /friends, /rewards, ...
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/about", destination: "/about.html" },
        { source: "/roadmap", destination: "/roadmap.html" },
        { source: "/contact", destination: "/contact.html" },
        { source: "/privacy", destination: "/privacy.html" },
        { source: "/terms", destination: "/terms.html" },
      ],
    };
  },
};
export default nextConfig;


