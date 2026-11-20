import { TENANT_HEADER } from "./tenant-header";

/**
 * The browser's client for the Medora API. Every call goes to this app's
 * own server at /api/backend/*, which attaches the session token and
 * forwards it to the API's /v1/* (src/lib/server/relay.ts). A call that
 * acts in a tenant names it, and it travels as a header. Errors arrive
 * in the API's envelope, { error: { code, message, details } }, and are
 * thrown as ApiError.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function errorOf(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: unknown } } | null;
  return new ApiError(
    response.status,
    body?.error?.code ?? "request_error",
    body?.error?.message ?? (response.statusText || "The request failed"),
    body?.error?.details,
  );
}

export async function request<T>(path: string, init: { method?: string; body?: unknown; tenant?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.tenant) headers[TENANT_HEADER] = init.tenant;
  const response = await fetch(`/api/backend${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  if (!response.ok) throw await errorOf(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
