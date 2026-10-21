import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false, // don't let `next dev` (re)create AGENTS.md
  cacheComponents: true,
  partialPrefetching: true,
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
