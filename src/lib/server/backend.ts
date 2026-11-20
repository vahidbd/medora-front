import "server-only";
import { auth } from "@clerk/nextjs/server";

/**
 * The web app's server in front of the Medora API (ADR 0030). Clerk owns
 * the browser session; this server exchanges it for Clerk's short-lived
 * session token and sends it as the bearer on every call. The token never
 * reaches the browser, and the API verifies it against Clerk's keys rather
 * than trusting anything this server says.
 */

export function backendOrigin(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

/** The API's address for a versioned path: "/staff" becomes "<origin>/v1/staff". */
export function backendApiUrl(path: string): string {
  return `${backendOrigin()}/v1${path.startsWith("/") ? path : `/${path}`}`;
}

/** The signed-in person's session token, or null without a Clerk session. Fetched per request, never stored. */
export async function backendToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}
