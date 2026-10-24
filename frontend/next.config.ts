import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Bangla/English (FND-18): messages and language are set up in i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the production
  // Docker image can run with a minimal runtime and no dev dependencies.
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // Keep transpile list lean. Ketcher / JSXGraph are loaded only when modals open.
  transpilePackages: ["mathlive"],
  serverExternalPackages: ["ketcher-standalone"],
};

export default withNextIntl(nextConfig);
