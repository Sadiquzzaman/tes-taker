import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run with a minimal runtime and no dev dependencies.
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // Keep transpile list lean — Ketcher is already prebuilt and is huge (~200MB).
  // Transpiling it made `next dev` appear stuck on unrelated routes like /dashboard.
  transpilePackages: ["mathlive", "tldraw"],
  serverExternalPackages: ["ketcher-standalone"],
};

export default nextConfig;
