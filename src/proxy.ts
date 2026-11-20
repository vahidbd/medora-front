import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkOriginOf, contentSecurityPolicy, newNonce, originOf } from "@/lib/server/content-security-policy";

/**
 * Every request starts here (Next 16 calls middleware "proxy").
 *
 * Clerk's handler makes auth() work in server code. It authorises nothing
 * by itself: the relay refuses to forward a request without a session
 * token, and the API verifies that token on every call.
 *
 * Each page gets a content security policy with its own nonce (ADR 0030).
 * Next reads the policy from the request headers and puts the nonce on its
 * own scripts; Clerk reads x-nonce for its script.
 */
const clerk = clerkMiddleware(async (_auth, request) => {
  const nonce = newNonce();
  const policy = contentSecurityPolicy({
    nonce,
    clerkOrigin: clerkOriginOf(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    sentryOrigin: originOf(process.env.NEXT_PUBLIC_SENTRY_DSN),
    development: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", policy);
  return response;
});

const HEALTH_PATHS = new Set(["/api/health", "/api/health/live"]);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  // Health checks need no session, and a Clerk handshake must never answer one.
  if (HEALTH_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();
  return clerk(request, event);
}

export const config = {
  // Everything but Next's own files and static assets, which never need a session.
  matcher: ["/((?!_next/static|_next/image|[^?]*\\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|txt|webmanifest)$).*)"],
};
