import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

const API_URL = process.env.NEXT_PUBLIC_INTERNAL_API_URL;

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));
const APP_VERSION: string = rootPkg.version;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_INTERNAL_API_URL is not set");
}

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: "standalone",

  // Expose app version from root package.json (managed by release-please)
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },

  // Rewrite API calls to the Hono backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
      {
        source: "/mcp",
        destination: `${API_URL}/mcp`,
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
