/**
 * Preview-mode stand-in for `@clerk/nextjs` (client and shared exports).
 *
 * Aliased in next.config.ts only when MEDORA_PREVIEW=1. Everyone is signed
 * in as the preview staff member, so the app needs no Clerk keys and no
 * network. Who that person is to Medora comes from the mock API's /v1/me.
 *
 * No "use client" on purpose: ClerkProvider renders from server layouts,
 * and the hooks are plain functions that return fixed values.
 */
import { createElement, Fragment } from "react";

export const PREVIEW_USER = {
  id: "user_preview_owner",
  firstName: "Alex",
  lastName: "Morgan",
  fullName: "Alex Morgan",
  username: null,
  imageUrl: "",
  hasImage: false,
  primaryEmailAddress: { id: "idn_preview", emailAddress: "owner@example.test" },
  emailAddresses: [{ id: "idn_preview", emailAddress: "owner@example.test" }],
  publicMetadata: {},
};

const getToken = async () => "mock-token";

function navigate(url) {
  if (typeof window !== "undefined") window.location.assign(url || "/");
}

async function signOut(callbackOrOptions, maybeOptions) {
  const options = typeof callbackOrOptions === "object" && callbackOrOptions !== null ? callbackOrOptions : maybeOptions;
  if (typeof callbackOrOptions === "function") await callbackOrOptions();
  navigate(options?.redirectUrl ?? "/");
}

const SESSION = { id: "sess_preview", status: "active", user: PREVIEW_USER, getToken };

const AUTH = {
  isLoaded: true,
  isSignedIn: true,
  userId: PREVIEW_USER.id,
  sessionId: SESSION.id,
  sessionClaims: { sub: PREVIEW_USER.id },
  actor: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  has: () => true,
  getToken,
  signOut,
};

const CLERK = {
  loaded: true,
  user: PREVIEW_USER,
  session: SESSION,
  signOut,
  openSignIn: () => navigate("/home"),
  // Clerk's account panel (where a second factor is added) has no stand-in; preview sessions always have one.
  openUserProfile: () => {},
  redirectToSignIn: () => navigate("/home"),
  addListener: () => () => {},
};

export function ClerkProvider({ children }) {
  return createElement(Fragment, null, children);
}

export const useAuth = () => AUTH;
export const useUser = () => ({ isLoaded: true, isSignedIn: true, user: PREVIEW_USER });
export const useClerk = () => CLERK;
export const useSession = () => ({ isLoaded: true, isSignedIn: true, session: SESSION });

export function SignUp() {
  return createElement(
    "div",
    { style: { padding: "16px", border: "1px dashed currentColor", borderRadius: "8px", lineHeight: 1.5 } },
    createElement("p", { style: { margin: "0 0 8px" } }, "Preview mode: accepting an invitation is simulated."),
    createElement("a", { href: "/home", style: { textDecoration: "underline" } }, "Continue to Home"),
  );
}

export function SignIn() {
  return createElement(
    "div",
    { style: { padding: "16px", border: "1px dashed currentColor", borderRadius: "8px", lineHeight: 1.5 } },
    createElement("p", { style: { margin: "0 0 8px" } }, "Preview mode: sign-in is simulated. You are signed in as Alex Morgan, an owner."),
    createElement("a", { href: "/home", style: { textDecoration: "underline" } }, "Continue to Home"),
  );
}
