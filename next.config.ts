import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The adapters read data/static and data/seed at runtime through fixed paths; make sure every API route ships them.
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
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
