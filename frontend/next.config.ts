import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run with a minimal runtime and no dev dependencies.
  output: "standalone",
  images: {
    unoptimized: true,
  },
  transpilePackages: ["mathlive", "kekule", "tldraw"],
};

export default nextConfig;
