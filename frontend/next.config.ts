import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "https://fra-atlas-backend-lrka.onrender.com/api";
const backendOrigin = apiBaseUrl.replace(/\/api\/?$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep production verification/build output separate when a dev server is active.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
