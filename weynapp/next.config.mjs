/** @type {import('next').NextConfig} */
const nextConfig = {
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
