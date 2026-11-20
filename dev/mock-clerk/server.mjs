/**
 * Preview-mode stand-in for `@clerk/nextjs/server`.
 *
 * Aliased in next.config.ts only when MEDORA_PREVIEW=1. `auth()` always
 * returns a session whose token the mock API accepts, and the middleware
 * runs the app's own handler (the content security policy) and nothing else.
 */
import { NextResponse } from "next/server";

const USER_ID = "user_preview_owner";
// PREVIEW_BACKEND_TOKEN lets a preview talk to a real local API
// (PREVIEW_BACKEND_URL) with a token from `npm run dev:token` there; the mock accepts anything.
const getToken = async () => process.env.PREVIEW_BACKEND_TOKEN || "mock-token";

const AUTH = {
  userId: USER_ID,
  sessionId: "sess_preview",
  sessionClaims: { sub: USER_ID },
  actor: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  isAuthenticated: true,
  has: () => true,
  getToken,
  protect: async () => AUTH,
  redirectToSignIn: () => NextResponse.redirect("/home"),
};

export async function auth() {
  return AUTH;
}
auth.protect = async () => AUTH;

/** Same call shapes as Clerk's: clerkMiddleware(), clerkMiddleware(handler), clerkMiddleware(handler, options). */
export function clerkMiddleware(handler) {
  return async function previewClerkMiddleware(request, event) {
    if (typeof handler === "function") {
      const authFn = async () => AUTH;
      authFn.protect = async () => AUTH;
      const result = await handler(authFn, request, event);
      if (result) return result;
    }
    return NextResponse.next();
  };
}
