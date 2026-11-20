import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests: plain functions with rules that can break. Screens are covered by the browser tests (test/e2e). */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The guard that keeps server modules out of the browser bundle; tests run on the server side anyway.
      "server-only": fileURLToPath(new URL("./test/unit/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
    expect: { requireAssertions: true },
  },
});
