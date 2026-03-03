import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_INTERNAL_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_INTERNAL_API_URL is not set");
}

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Rewrite API calls to the Hono backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
