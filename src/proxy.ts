import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkOriginOf, contentSecurityPolicy, newNonce, originOf } from "@/lib/server/content-security-policy";
import { BRAND_HEADER, brandHeaderValue } from "@/lib/brand";
import { brandLookup } from "@/lib/server/brand";
import { BRAND_HOST_HEADER, consoleHostsFrom, isPatientFilePath, normaliseHost, patientPath, surfaceOf } from "@/lib/surface";

/**
 * Every request starts here (Next 16 calls middleware "proxy").
 *
 * The host decides the surface (ADR 0180): the console's hosts get the staff
 * console; any other host must be a brand's patient-app domain, and its
 * paths are rewritten into the patient app's tree (/home renders
 * /patient/home). The patient tree is never served at its own address, and
 * a console path never renders on a patient host.
 *
 * Clerk's handler makes auth() work in server code, with the patient
 * instance's keys on a patient host (ADR 0100). It authorises nothing by
 * itself: the relay refuses to forward a request without a session token,
 * and the API verifies that token on every call.
 *
 * Each page gets a content security policy with its own nonce (ADR 0030).
 * Next reads the policy from the request headers and puts the nonce on its
 * own scripts; Clerk reads x-nonce for its script.
 */

const HEALTH_PATHS = new Set(["/api/health", "/api/health/live"]);

function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404, headers: { "cache-control": "no-store", "content-type": "text/plain" } });
}

/**
 * The same request at another path. A clone of nextUrl keeps Next's own
 * origin, so the rewrite stays on this server; any other origin, the
 * brand's host included, would make Next fetch it as an outside address.
 * (Next writes 127.0.0.1 as localhost here, so a server started with
 * -H 127.0.0.1 can't rewrite; the image binds 0.0.0.0.)
 */
function internal(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
}

function withPolicy(request: NextRequest, publishableKey: string | undefined, extra: Record<string, string>, rewrite: string | null) {
  const nonce = newNonce();
  const policy = contentSecurityPolicy({
    nonce,
    clerkOrigin: clerkOriginOf(publishableKey),
    // Patient pages never load browser error tracking (ADR 0026), so their policy has no tracker to talk to.
    sentryOrigin: rewrite ? null : originOf(process.env.NEXT_PUBLIC_SENTRY_DSN),
    development: process.env.NODE_ENV === "development",
  });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  // A caller can't name a brand: these headers are always this proxy's own.
  headers.delete(BRAND_HOST_HEADER);
  headers.delete(BRAND_HEADER);
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  const response = rewrite ? NextResponse.rewrite(internal(request, rewrite), { request: { headers } }) : NextResponse.next({ request: { headers } });
  response.headers.set("content-security-policy", policy);
  // Patient pages show health data: nothing in between may keep a copy (APP3).
  if (rewrite) response.headers.set("cache-control", "no-store");
  return response;
}

const staffClerk = clerkMiddleware(async (_auth, request) =>
  withPolicy(request, process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, {}, null),
);

const patientClerk = clerkMiddleware(
  async (_auth, request) => {
    const host = normaliseHost(request.headers.get("host")) ?? "";
    // proxy() below found this brand a moment ago; the lookup is kept, so this costs nothing.
    const lookup = await brandLookup(host);
    if (lookup.state !== "found") return notFound();
    const { pathname } = request.nextUrl;
    // The relay and the health checks keep their own addresses; every page is rewritten into the patient tree.
    const rewrite = pathname.startsWith("/api/") ? null : patientPath(pathname);
    const brandHeaders = { [BRAND_HOST_HEADER]: host, [BRAND_HEADER]: brandHeaderValue(lookup.brand) };
    const response = withPolicy(request, process.env.PATIENT_CLERK_PUBLISHABLE_KEY, brandHeaders, rewrite);
    if (!rewrite) response.headers.set("cache-control", "no-store");
    return response;
  },
  {
    publishableKey: process.env.PATIENT_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.PATIENT_CLERK_SECRET_KEY,
    signInUrl: "/sign-in",
  },
);

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  // Health checks need no session, and a Clerk handshake must never answer one.
  if (HEALTH_PATHS.has(pathname)) return NextResponse.next();
  // The patient tree's own addresses are never served, on any host: only the rewrite reaches them.
  if (isPatientFilePath(pathname)) return notFound();

  const host = normaliseHost(request.headers.get("host"));
  const surface = surfaceOf(host, consoleHostsFrom(process.env.CONSOLE_HOSTS));
  if (surface === "console") return staffClerk(request, event);
  if (surface !== "patient" || !host) return notFound();

  // Default deny: a host that isn't a brand's patient-app domain answers nothing (APP1).
  const lookup = await brandLookup(host);
  if (lookup.state === "unknown") return notFound();
  if (lookup.state === "failed") {
    return new NextResponse("This service is unavailable at the moment. Try again shortly.", {
      status: 503,
      headers: { "cache-control": "no-store", "content-type": "text/plain", "retry-after": "30" },
    });
  }
  // The relay's address is the same on both surfaces, and the start flow's server routes (ADR 0280) are a brand host's own; only a page is the patient app's.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/backend/") && !pathname.startsWith("/api/start/")) return notFound();
  return patientClerk(request, event);
}

export const config = {
  // Everything but Next's own files and static assets, which never need a session.
  matcher: ["/((?!_next/static|_next/image|[^?]*\\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|txt|webmanifest)$).*)"],
};
