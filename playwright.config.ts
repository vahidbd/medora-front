import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests run the preview build (dev/README.md): every screen against
 * the mock API, with sign-in stubbed out. Build it first:
 *
 *   npm run build:preview && npm run test:e2e
 *
 * PLAYWRIGHT_BASE_URL points the tests at an app that is already running.
 */
const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `node dev/preview.mjs start -p ${PORT} -H 127.0.0.1`,
        url: `${baseURL}/api/health/live`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
