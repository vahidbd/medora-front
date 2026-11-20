import * as Sentry from "@sentry/nextjs";
import { DATA_COLLECTION, SENTRY_DSN, beforeSend, scrubBreadcrumb } from "./scrub";

/**
 * Error tracking in the browser, on staff screens only. <ErrorReporting>
 * (inside <StaffClerk>) loads this module. Server errors are reported from
 * the server (src/instrumentation.ts).
 *
 * Off when NEXT_PUBLIC_SENTRY_DSN is unset. No session replay and no
 * tracing: errors only (ADR 0026).
 */

/**
 * Left out: session tracking (a request to Sentry on every page load, for
 * crash-free rates nobody reads yet).
 */
const DROPPED_INTEGRATIONS = new Set(["BrowserSession"]);

let started = false;

export function startBrowserErrorTracking(): boolean {
  if (started) return true;
  if (!SENTRY_DSN) return false;
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_MEDORA_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE_SHA,
    dataCollection: DATA_COLLECTION,
    integrations: (defaults) => defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
    initialScope: { tags: { service: "web-browser" } },
    beforeSend,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  started = true;
  return true;
}

/** The staff member's id on every report (never their name or email). */
export function setStaffUser(id: string | null): void {
  try {
    if (!startBrowserErrorTracking()) return;
    Sentry.setUser(id ? { id } : null);
  } catch {
    // Best effort: reporting must never break a screen.
  }
}

/** Report an error a boundary caught (a screen that failed to draw). */
export function reportBrowserError(error: unknown, tags?: Record<string, string>): void {
  try {
    if (!startBrowserErrorTracking()) return;
    Sentry.withScope((scope) => {
      if (tags) scope.setTags(tags);
      Sentry.captureException(error);
    });
  } catch {
    // Best effort: reporting must never break a screen.
  }
}
