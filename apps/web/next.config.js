/** @type {import('next').NextConfig} */

const API_URL = process.env.API_URL || "http://localhost:3001";

console.log("Next config - API_URL", API_URL);

const nextConfig = {
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

module.exports = nextConfig;
