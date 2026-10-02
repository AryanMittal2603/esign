import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // "Projects" were renamed to "Exams"; keep old bookmarks working.
      { source: "/admin/projects/:path*", destination: "/admin/exams/:path*", permanent: true },
      { source: "/admin/audit", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
