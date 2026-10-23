import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for components and hooks (jsdom). Run with `npm test` or `make frontend-test`.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    restoreMocks: true,
  },
});
