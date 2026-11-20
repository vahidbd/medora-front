import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * What error tracking may send, for the browser and the server alike: an
 * error's type, message and stack, a route, and the staff member's id. Never
 * a query string, a token in a path, a header, a cookie, an IP address or
 * anything typed on a page (ADR 0026). Messages are masked for email
 * addresses and long numbers (phones, Medicare and IHI numbers, dates of
 * birth), because an error message can quote a value. Mirrors the API's
 * src/lib/error-tracking.ts.
 */

/** Keeps the monthly quota: the same error goes once per ten minutes per tab or server instance. */
const THROTTLE_MS = 10 * 60_000;
const THROTTLE_KEYS_MAX = 200;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/**
 * Eight or more digits, optionally split by single spaces, dashes, dots or
 * slashes: phones, Medicare and IHI numbers, and dates (a date of birth among them).
 */
const LONG_NUMBER = /\+?\b\d(?:[ ./-]?\d){7,}\b/g;

/** No DSN, no error tracking: the build has nothing to report to. */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

/** Nothing that would identify a person: see the comment at the top. */
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [] as never[],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
};

export function maskText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(LONG_NUMBER, "[number]");
}

/**
 * An address with nothing personal left: no query or fragment, and any path
 * segment that looks like a token (16+ characters with letters and digits,
 * as one-time links carry) replaced.
 */
export function scrubUrl(url: string): string {
  let origin = "";
  let path = url.split(/[?#]/, 1)[0] ?? "";
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    path = parsed.pathname;
  } catch {
    // A path on its own: already split above.
  }
  return (
    origin +
    path
      .split("/")
      .map((segment) => (segment.length >= 16 && /\d/.test(segment) && /[a-z]/i.test(segment) ? ":token" : segment))
      .join("/")
      .replace(EMAIL, "[email]")
  );
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    const route = event.tags?.route;
    // The browser's name and version, which Sentry reads from this header. Nothing else from the headers.
    const userAgent = event.request.headers?.["User-Agent"];
    event.request = {
      method: event.request.method,
      url: typeof route === "string" ? route : event.request.url ? scrubUrl(event.request.url) : undefined,
      ...(userAgent ? { headers: { "User-Agent": userAgent } } : {}),
    };
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.message) event.message = maskText(event.message);
  if (event.logentry?.message) event.logentry.message = maskText(event.logentry.message);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = maskText(exception.value);
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter((crumb): crumb is Breadcrumb => crumb !== null);
  }
  delete event.user?.email;
  delete event.user?.ip_address;
  delete event.user?.username;
  return event;
}

/**
 * Console lines and clicks are dropped (a click's target can be a patient's
 * name); navigations and requests keep their address, scrubbed.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category ?? "";
  if (category === "console" || category.startsWith("ui.")) return null;
  const crumb: Breadcrumb = { ...breadcrumb };
  if (crumb.message) crumb.message = maskText(crumb.message);
  if (crumb.data) {
    const data: Record<string, unknown> = { ...crumb.data };
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = scrubUrl(data[key] as string);
    }
    delete data["http.query"];
    delete data["http.fragment"];
    crumb.data = data;
  }
  return crumb;
}

const lastSent = new Map<string, number>();

/** False when the same error went less than THROTTLE_MS ago. */
export function shouldSend(event: ErrorEvent, now = Date.now()): boolean {
  if (event.level === "fatal") return true;
  const exception = event.exception?.values?.[0];
  const key = [event.tags?.route, exception?.type, exception?.value ?? event.message].join("|");
  const last = lastSent.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return false;
  lastSent.delete(key);
  lastSent.set(key, now);
  while (lastSent.size > THROTTLE_KEYS_MAX) {
    const oldest = lastSent.keys().next().value;
    if (oldest === undefined) break;
    lastSent.delete(oldest);
  }
  return true;
}

export function beforeSend(event: ErrorEvent): ErrorEvent | null {
  return shouldSend(event) ? scrubEvent(event) : null;
}
