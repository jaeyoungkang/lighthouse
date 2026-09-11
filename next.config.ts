import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: __dirname,
  },
  redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "search.themoonlight.io",
          },
        ],
        destination: "https://scholar.themoonlight.io/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
