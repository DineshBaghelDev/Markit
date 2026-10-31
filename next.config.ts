import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Convex deployment URLs are public; never expose API keys in this block.
  env: {
    NEXT_PUBLIC_CONVEX_URL:
      process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
