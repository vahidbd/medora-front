"use client";
/**
 * Preview-mode stand-in for `@clerk/nextjs` (client and shared exports).
 *
 * Aliased in next.config.ts only when MEDORA_PREVIEW=1, so the app needs no
 * Clerk keys and no network. There are two instances, as in a deployment
 * (ADR 0100), told apart by the provider's publishable key:
 *
 * - Staff: everyone is signed in as the preview staff member. Who that
 *   person is to Medora comes from the mock API's /v1/me.
 * - Patient (the provider given PATIENT_PREVIEW_KEY): signed out until the
 *   one-time code flow finishes. The session is a host-only cookie holding
 *   "patient" or "new" and a random session id, nothing else; the server
 *   stand-in reads it, and each new session has its own id, as Clerk's do.
 *   jamie@example.test has an account, any other address signs up, and the
 *   code is always 424242.
 *
 * "use client" because the patient session is state; server layouts still
 * render ClerkProvider, as they do Clerk's own.
 */
import { createContext, createElement, useContext, useSyncExternalStore } from "react";

export const PATIENT_PREVIEW_KEY = "pk_test_preview_patient";
const PATIENT_COOKIE = "medora_preview_patient";
const PREVIEW_CODE = "424242";
const KNOWN_PATIENT = "jamie@example.test";

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

function patientUser(kind) {
  const emailAddress = kind === "new" ? "new.patient@example.test" : KNOWN_PATIENT;
  const address = { id: "idn_preview_patient", emailAddress };
  return {
    id: `user_preview_${kind}`,
    firstName: null,
    lastName: null,
    fullName: null,
    username: null,
    imageUrl: "",
    hasImage: false,
    primaryEmailAddress: address,
    emailAddresses: [address],
    publicMetadata: {},
  };
}

function navigate(url) {
  if (typeof window !== "undefined") window.location.assign(url || "/");
}

// The patient session: the cookie, read through an external store so the server render and hydration agree.
const listeners = new Set();
function readPatientSession() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${PATIENT_COOKIE}=([^;]*)`));
  return match ? match[1] : "";
}
function setPatientSession(kind) {
  document.cookie = kind ? `${PATIENT_COOKIE}=${kind}; path=/; samesite=lax` : `${PATIENT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  for (const listener of listeners) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** null while not yet known (the server render), "" signed out, otherwise "patient" or "new". */
function usePatientSession() {
  const value = useSyncExternalStore(subscribe, readPatientSession, () => null);
  return value === null ? null : (value.split(".")[0] ?? "");
}

async function signOut(callbackOrOptions, maybeOptions) {
  const options = typeof callbackOrOptions === "object" && callbackOrOptions !== null ? callbackOrOptions : maybeOptions;
  if (typeof callbackOrOptions === "function") await callbackOrOptions();
  if (typeof document !== "undefined") setPatientSession("");
  navigate(options?.redirectUrl ?? "/");
}

const getToken = async () => "mock-token";
const SESSION = { id: "sess_preview", status: "active", user: PREVIEW_USER, getToken };

const STAFF_AUTH = {
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

const NOT_LOADED = { isLoaded: false, isSignedIn: undefined, userId: undefined, sessionId: undefined, has: () => false, getToken: async () => null, signOut };
const SIGNED_OUT = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null, has: () => false, getToken: async () => null, signOut };

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

function patientAuth(kind) {
  const user = patientUser(kind);
  return { ...SIGNED_OUT, isSignedIn: true, userId: user.id, sessionId: `sess_preview_${kind}`, has: () => true, getToken: async () => `mock-patient-token-${kind}` };
}

const Instance = createContext("staff");

export function ClerkProvider({ publishableKey, children }) {
  return createElement(Instance.Provider, { value: publishableKey === PATIENT_PREVIEW_KEY ? "patient" : "staff" }, children);
}

export function useAuth() {
  const instance = useContext(Instance);
  const session = usePatientSession();
  if (instance === "staff") return STAFF_AUTH;
  if (session === null) return NOT_LOADED;
  return session ? patientAuth(session) : SIGNED_OUT;
}

export function useUser() {
  const instance = useContext(Instance);
  const session = usePatientSession();
  if (instance === "staff") return { isLoaded: true, isSignedIn: true, user: PREVIEW_USER };
  if (session === null) return { isLoaded: false, isSignedIn: undefined, user: undefined };
  return session ? { isLoaded: true, isSignedIn: true, user: patientUser(session) } : { isLoaded: true, isSignedIn: false, user: null };
}

export function useSession() {
  const { isLoaded, isSignedIn } = useAuth();
  return { isLoaded, isSignedIn, session: isSignedIn ? SESSION : null };
}

const PATIENT_CLERK = {
  loaded: true,
  user: null,
  session: null,
  signOut,
  openSignIn: () => navigate("/sign-in"),
  openUserProfile: () => {},
  redirectToSignIn: () => navigate("/sign-in"),
  addListener: () => () => {},
};

export function useClerk() {
  return useContext(Instance) === "staff" ? CLERK : PATIENT_CLERK;
}

// The one-time code flows, in the shapes of Clerk's sign-in and sign-up futures: every call answers { error }.
const failed = (code, message) => ({ error: { code, message, longMessage: message } });
const ok = { error: null };

function finalizeAs(kind) {
  return async ({ navigate: go } = {}) => {
    setPatientSession(`${kind}.${Math.random().toString(36).slice(2, 12)}`);
    if (go) await go({ session: { id: `sess_preview_${kind}` }, decorateUrl: (url) => url });
    return ok;
  };
}

const signIn = {
  status: null,
  identifier: null,
  async create({ identifier }) {
    signIn.status = null;
    if (String(identifier).trim().toLowerCase() !== KNOWN_PATIENT) {
      signIn.identifier = null;
      return failed("form_identifier_not_found", "Couldn't find your account.");
    }
    signIn.identifier = KNOWN_PATIENT;
    signIn.status = "needs_first_factor";
    return ok;
  },
  emailCode: {
    async sendCode() {
      return signIn.identifier ? ok : failed("form_identifier_not_found", "Couldn't find your account.");
    },
    async verifyCode({ code }) {
      if (!signIn.identifier || code !== PREVIEW_CODE) return failed("form_code_incorrect", "Incorrect code");
      signIn.status = "complete";
      return ok;
    },
  },
  finalize: finalizeAs("patient"),
};

const signUp = {
  status: null,
  emailAddress: null,
  async create({ emailAddress }) {
    signUp.emailAddress = emailAddress;
    signUp.status = "missing_requirements";
    return ok;
  },
  verifications: {
    async sendEmailCode() {
      return signUp.emailAddress ? ok : failed("form_param_missing", "Enter an email address.");
    },
    async verifyEmailCode({ code }) {
      if (!signUp.emailAddress || code !== PREVIEW_CODE) return failed("form_code_incorrect", "Incorrect code");
      signUp.status = "complete";
      return ok;
    },
  },
  finalize: finalizeAs("new"),
};

export const useSignIn = () => ({ signIn, errors: {}, fetchStatus: "idle" });
export const useSignUp = () => ({ signUp, errors: {}, fetchStatus: "idle" });

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
