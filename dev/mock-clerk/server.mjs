/**
 * Preview-mode stand-in for `@clerk/nextjs/server`.
 *
 * Aliased in next.config.ts only when MEDORA_PREVIEW=1. On the console,
 * `auth()` always returns the preview staff member's session. On a brand's
 * patient host (the proxy has set x-medora-brand-host) it reads the patient
 * session cookie the client stand-in sets (mock-clerk/nextjs.mjs): signed
 * out without it, otherwise a patient token the mock API knows. The
 * middleware runs the app's own handler and nothing else.
 */
import { cookies, headers } from "next/headers";
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

const PATIENT_COOKIE = "medora_preview_patient";

function patientAuth(session) {
  const [kind, sid] = session?.split(".") ?? [];
  const valid = (kind === "patient" || kind === "new") && /^[a-z0-9]{1,16}$/.test(sid ?? "");
  const userId = valid ? `user_preview_${kind}` : null;
  const getPatientToken = async () => (valid ? `mock-patient-${kind}-${sid}` : null);
  return {
    ...AUTH,
    userId,
    sessionId: valid ? `sess_${sid}` : null,
    sessionClaims: valid ? { sub: userId, sid: `sess_${sid}` } : null,
    isAuthenticated: valid,
    has: () => valid,
    getToken: getPatientToken,
  };
}

export async function auth() {
  let brandHost = null;
  try {
    brandHost = (await headers()).get("x-medora-brand-host");
  } catch {
    // Outside a request (the proxy's own handler): the staff session.
  }
  if (!brandHost) return AUTH;
  return patientAuth((await cookies()).get(PATIENT_COOKIE)?.value);
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
