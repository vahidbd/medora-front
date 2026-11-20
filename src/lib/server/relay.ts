import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HEADER } from "@/lib/api/tenant-header";
import { BRAND_HOST_HEADER, normaliseHost } from "@/lib/surface";
import { backendApiUrl, backendToken } from "@/lib/server/backend";
import { brandLookup } from "@/lib/server/brand";
import { clientIpHeaders } from "@/lib/server/client-ip";

/*
 * The browser's only way to the API: /api/backend/<path> goes to the API's
 * /v1/<path> with the session token attached (ADR 0030). Only the headers
 * the API needs go up, and only the ones the page needs come back.
 *
 * The surface scopes it (ADR 0037): on a brand's patient host (the proxy
 * sets x-medora-brand-host, and only the proxy can) it reaches the API's
 * /v1/patient/* and nothing else, and nothing it returns may be kept. The
 * tenant there is the brand's, found from the host by this server; the
 * browser's tenant header is ignored (docs/decisions/patients.md IDN4 in
 * the API). On the console it never reaches /v1/patient/*.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPLY_HEADERS = ["content-type", "content-disposition", "content-length", "cache-control", "retry-after"];
/** Types a browser could run script from, if a file of that type came back from the API. */
const ACTIVE_TYPES = /^\s*(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/xsl)\b/i;
/** The API refuses bodies over 1 MB; this stops a bigger one before it is read. */
const MAX_BODY_BYTES = 1024 * 1024;

/** A refusal in the API's own shape, { error: { code, message } }. */
export function refusal(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

/** Every reply is nosniff; a type that can run script is sandboxed. */
export function inertHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  for (const name of REPLY_HEADERS) {
    const value = upstream.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-content-type-options", "nosniff");
  if (ACTIVE_TYPES.test(headers.get("content-type") ?? "")) headers.set("content-security-policy", "sandbox");
  return headers;
}

/** A patient's tenant: the brand's, from its host, never from the browser. */
async function brandTenant(host: string): Promise<string | NextResponse> {
  const lookup = await brandLookup(host);
  if (lookup.state === "found") return lookup.brand.tenantId;
  if (lookup.state === "unknown") return refusal("not_found", "Route not found", 404);
  return refusal("backend_unreachable", "Medora can't be reached at the moment", 503);
}

export async function relay(request: NextRequest, path: string[]): Promise<NextResponse> {
  const token = await backendToken();
  if (!token) return refusal("unauthorized", "Sign in to carry on", 401);

  const brandHost = normaliseHost(request.headers.get(BRAND_HOST_HEADER));
  const patientRoute = path[0] === "patient";
  if (brandHost ? !patientRoute : patientRoute) return refusal("not_found", "Route not found", 404);

  const tenant = brandHost ? await brandTenant(brandHost) : request.headers.get(TENANT_HEADER);
  if (tenant instanceof NextResponse) return tenant;
  if (tenant !== null && !UUID.test(tenant)) return refusal("bad_request", "That tenant id is not valid", 400);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return refusal("too_large", "That is more than the API accepts", 413);

  // A "." or ".." segment would step out of /v1 once the address is resolved.
  if (path.some((segment) => segment === "" || segment === "." || segment === "..")) return refusal("not_found", "Route not found", 404);
  const url = new URL(backendApiUrl(`/${path.map(encodeURIComponent).join("/")}`));
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

  const headers = new Headers({ authorization: `Bearer ${token}`, accept: request.headers.get("accept") ?? "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (tenant) headers.set(TENANT_HEADER, tenant);
  if (brandHost) headers.set(BRAND_HOST_HEADER, brandHost);
  for (const [name, value] of Object.entries(clientIpHeaders(request.headers))) headers.set(name, value);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  if (body && body.byteLength > MAX_BODY_BYTES) return refusal("too_large", "That is more than the API accepts", 413);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return refusal("backend_unreachable", "Medora can't be reached at the moment", 502);
  }
  const replyHeaders = inertHeaders(upstream.headers);
  if (brandHost) replyHeaders.set("cache-control", "no-store");
  return new NextResponse(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: replyHeaders });
}
