import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * Security headers on every response (ADR 0030). The content security
 * policy carries a nonce per request, so it is set in src/proxy.ts; these
 * are the fixed ones.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Video and phone consults will ask for the camera and microphone on their own pages (ADR 0020).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

/**
 * The commit this build is (ADR 0024). A deploy writes release-sha.txt
 * before it uploads; the value is baked into the build for the server and
 * the browser alike, so /api/health and error reports say which commit runs.
 */
const releaseSha = existsSync("release-sha.txt") ? readFileSync("release-sha.txt", "utf8").trim() : process.env.RELEASE_SHA || "development";

const nextConfig: NextConfig = {
  // One self-contained server in the image (Dockerfile): Railway in Sydney first (ADR 0005).
  output: "standalone",
  poweredByHeader: false,
  env: { NEXT_PUBLIC_RELEASE_SHA: releaseSha },
  // `next build` type-checks the project and fails on any error; never turn that off.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

/**
 * Preview mode (dev/README.md): `npm run dev:preview` sets MEDORA_PREVIEW=1
 * to run every screen against the local mock API, with Clerk swapped for
 * stubs that sign everyone in. It builds into its own folder. Unset, this
 * returns the config untouched.
 */
function withPreview(config: NextConfig): NextConfig {
  if (process.env.MEDORA_PREVIEW !== "1") return config;
  // A stray flag on a hosted build must fail the build, never ship sign-in stubbed out.
  if (process.env.RAILWAY_ENVIRONMENT || process.env.MEDORA_ENV === "staging" || process.env.MEDORA_ENV === "production" || process.env.CI_DEPLOY) {
    throw new Error("MEDORA_PREVIEW=1 is set on a hosted build. Preview mode stubs out sign-in and only runs locally; unset it.");
  }
  return {
    ...config,
    // Served by `next start` on a laptop or in CI, never as the standalone server.
    output: undefined,
    distDir: ".next/preview",
    // A tsconfig that only `extends` the real one, so Next never rewrites tsconfig.json for the preview folder.
    typescript: { tsconfigPath: "dev/tsconfig.preview.json" },
    turbopack: {
      resolveAlias: {
        "@clerk/nextjs/server": "./dev/mock-clerk/server.mjs",
        "@clerk/nextjs": "./dev/mock-clerk/nextjs.mjs",
      },
    },
  };
}

export default withPreview(nextConfig);
