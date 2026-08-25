/** @type {import('next').NextConfig} */
const nextConfig = {
  // The preview is served through a proxy hostname that changes whenever the
  // environment is recreated, so allow the derived dev origin explicitly.
  // (Next.js wildcards only cover subdomains, so a bare "*" does not match.)
  allowedDevOrigins: process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? ["3000-" + process.env.BASE44_PUBLIC_HOST_SUFFIX]
    : [],
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

