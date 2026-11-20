import type { Instrumentation } from "next";

/**
 * Server-side error tracking for the web app (ADR 0026): server
 * components, route handlers (the /api/* relay) and the proxy. Off when
 * NEXT_PUBLIC_SENTRY_DSN is unset. Browser errors are reported separately,
 * on staff screens only (lib/error-tracking/browser.ts).
 *
 * The SDK is loaded only when there is a DSN, so a build without one runs
 * exactly as before.
 */
export async function register() {
  // Node-only, so it is loaded only on Node (Next's pattern for runtime-specific code).
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("@/lib/server/deployed-settings")).refuseUnsafeSettings();
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const [Sentry, { DATA_COLLECTION, SENTRY_DSN, beforeSend, scrubBreadcrumb }] = await Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/error-tracking/scrub"),
  ]);
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.MEDORA_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_RELEASE_SHA,
    dataCollection: DATA_COLLECTION,
    // Console lines can quote what a page was showing.
    integrations: (defaults) => defaults.filter((integration) => integration.name !== "Console"),
    initialScope: { tags: { service: "web-server", runtime: process.env.NEXT_RUNTIME ?? "nodejs" } },
    beforeSend,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}

/**
 * A server error while rendering a page or answering a route. Reported with
 * the route's file path (/(app)/staff/page), never the address as typed:
 * one-time links carry their token in it, and a query can carry an email
 * address.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  // Next's own control flow (redirect, notFound, a prerender bailing out to dynamic) is not an error.
  if (digest && CONTROL_FLOW.test(digest)) return;
  // Best effort: reporting must never change what the page or route does.
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.withScope((scope) => {
      scope.setTags({
        route: context.routePath,
        route_type: context.routeType,
        method: request.method,
      });
      if (digest) scope.setTag("digest", digest);
      Sentry.captureException(error);
    });
    await Sentry.flush(2_000);
  } catch {
    // Nothing to do: the error is already in the server's log.
  }
};

const CONTROL_FLOW = /^(NEXT_|HANGING_PROMISE_REJECTION|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/;
