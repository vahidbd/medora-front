/*
 * One deployment, two surfaces (ADR 0037, docs/decisions/patient-app.md APP1).
 * The host a request arrived on decides which one answers: the staff
 * console on the hosts named in CONSOLE_HOSTS, and a brand's patient app on
 * every other host, which must then be a brand's patient-app domain. The
 * host is the platform's Host header, never a forwarded one a caller could
 * write.
 */

export type Surface = "console" | "patient";

/** Patient pages live under this segment and are reached only through the proxy's rewrite. */
export const PATIENT_PREFIX = "/patient";

/** The header the proxy and the relay use to tell the API which brand's patient app a request came from. */
export const BRAND_HOST_HEADER = "x-medora-brand-host";

const DEFAULT_CONSOLE_HOSTS = ["localhost", "127.0.0.1"];
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** "App.Brand.com.au:443" becomes "app.brand.com.au"; anything that isn't a plain host name becomes null. */
export function normaliseHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = raw.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return HOST.test(host) ? host : null;
}

/** The console's hosts: a comma-separated CONSOLE_HOSTS, else localhost for development. */
export function consoleHostsFrom(value: string | undefined): string[] {
  const hosts = (value ?? "")
    .split(",")
    .map((part) => normaliseHost(part))
    .filter((host): host is string => host !== null);
  return hosts.length > 0 ? hosts : DEFAULT_CONSOLE_HOSTS;
}

/** Which surface a host serves. A host that isn't a plain name serves nothing. */
export function surfaceOf(host: string | null, consoleHosts: readonly string[]): Surface | null {
  if (!host) return null;
  return consoleHosts.includes(host) ? "console" : "patient";
}

/** A patient host's address as the app sees it: "/home" is the file at "/patient/home". */
export function patientPath(pathname: string): string {
  return pathname === "/" ? PATIENT_PREFIX : `${PATIENT_PREFIX}${pathname}`;
}

/** The patient app's own paths, asked for directly, on any host: never served. */
export function isPatientFilePath(pathname: string): boolean {
  return pathname === PATIENT_PREFIX || pathname.startsWith(`${PATIENT_PREFIX}/`);
}
