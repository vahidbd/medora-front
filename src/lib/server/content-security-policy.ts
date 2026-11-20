/*
 * The web app's content security policy (ADR 0030): scripts run only from
 * this origin and only with this response's nonce ('strict-dynamic' lets a
 * script carrying the nonce load what it needs, as Clerk's does), nothing
 * can frame the app, and the page talks only to this origin, Clerk and the
 * error tracker. Built per request in src/proxy.ts.
 */

export interface PolicyInput {
  nonce: string;
  /** Clerk's Frontend API origin, from the publishable key. */
  clerkOrigin: string | null;
  /** The error tracker's origin, from NEXT_PUBLIC_SENTRY_DSN. */
  sentryOrigin: string | null;
  /** next dev: React's dev build needs eval, and the page is served over http. */
  development: boolean;
}

/** A fresh nonce: 16 random bytes, base64. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Clerk's Frontend API origin, which the publishable key carries: pk_test_<base64 of "host$">. */
export function clerkOriginOf(publishableKey: string | undefined): string | null {
  const encoded = /^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/.exec(publishableKey ?? "")?.[1];
  if (!encoded) return null;
  try {
    const host = atob(encoded.replace(/-/g, "+").replace(/_/g, "/")).replace(/\$$/, "");
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}

/** The origin of a URL such as a Sentry DSN, or null. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({ nonce, clerkOrigin, sentryOrigin, development }: PolicyInput): string {
  const clerk = clerkOrigin ? [clerkOrigin] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...clerk, ...(development ? ["'unsafe-eval'"] : [])],
    // Inline styles: React's style props, Clerk's sign-in card and toasts set them. Styles can't run script.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...clerk, ...(sentryOrigin ? [sentryOrigin] : [])],
    // Clerk's bot check on sign-in runs in Cloudflare's frame.
    "frame-src": ["'self'", "https://challenges.cloudflare.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!development) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}
