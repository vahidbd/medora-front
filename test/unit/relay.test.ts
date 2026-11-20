import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const token = vi.hoisted(() => ({ value: "session-token" as string | null }));
vi.mock("@/lib/server/backend", () => ({
  backendApiUrl: (path: string) => `http://api.test/v1${path}`,
  backendToken: async () => token.value,
}));

const BRAND_TENANT = "10000000-0000-4000-8000-000000000002";
const brand = vi.hoisted(() => ({ state: "found" as "found" | "unknown" | "failed" }));
vi.mock("@/lib/server/brand", () => ({
  brandLookup: async (host: string) =>
    brand.state === "found" && host === "app.kestrel.test"
      ? { state: "found", brand: { tenantId: "10000000-0000-4000-8000-000000000002" } }
      : { state: brand.state === "found" ? "unknown" : brand.state },
}));

const { inertHeaders, relay } = await import("@/lib/server/relay");

const TENANT = "10000000-0000-4000-8000-000000000001";
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  token.value = "session-token";
  brand.state = "found";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function call(path: string[], init: { method?: string; headers?: Record<string, string>; body?: string; search?: string } = {}) {
  const request = new NextRequest(`http://web.test/api/backend/${path.map(encodeURIComponent).join("/")}${init.search ?? ""}`, {
    method: init.method ?? "GET",
    headers: init.headers,
    body: init.body,
  });
  return relay(request, path);
}

function sent(): { url: string; headers: Headers; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), headers: new Headers(init?.headers), init: init ?? {} };
}

describe("relay", () => {
  it("forwards to the API's /v1 with the session token, the tenant and the query", async () => {
    const response = await call(["staff"], { headers: { "x-medora-tenant": TENANT, cookie: "__session=abc" }, search: "?page=2" });
    expect(response.status).toBe(200);
    const { url, headers } = sent();
    expect(url).toBe("http://api.test/v1/staff?page=2");
    expect(headers.get("authorization")).toBe("Bearer session-token");
    expect(headers.get("x-medora-tenant")).toBe(TENANT);
    expect(headers.get("cookie")).toBeNull();
  });

  it("refuses without a session, and never calls the API", async () => {
    token.value = null;
    const response = await call(["staff"]);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a tenant that isn't an id", async () => {
    const response = await call(["staff"], { headers: { "x-medora-tenant": "../../admin" } });
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never steps out of /v1", async () => {
    for (const path of [["..", "health"], [".", "staff"], ["staff", "", "x"]]) {
      expect((await call(path)).status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a segment one segment", async () => {
    await call(["staff", "a/b?c"]);
    expect(sent().url).toBe("http://api.test/v1/staff/a%2Fb%3Fc");
  });

  it("refuses a body over 1 MB before reading it", async () => {
    const response = await call(["staff"], { method: "POST", headers: { "content-length": String(2 * 1024 * 1024) }, body: "{}" });
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a change's body and type", async () => {
    await call(["staff", TENANT], { method: "PATCH", headers: { "content-type": "application/json" }, body: '{"role":"support"}' });
    const { headers, init } = sent();
    expect(init.method).toBe("PATCH");
    expect(headers.get("content-type")).toBe("application/json");
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"role":"support"}');
  });

  it("answers 502 in the API's shape when the API can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const response = await call(["staff"]);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "backend_unreachable", message: "Medora can't be reached at the moment" } });
  });
});

describe("relay on a brand's patient host", () => {
  const PATIENT_HOST = { "x-medora-brand-host": "app.kestrel.test" };

  it("forwards a patient route with the brand's host and the brand's tenant, never the caller's", async () => {
    const response = await call(["patient", "me"], { headers: { ...PATIENT_HOST, "x-medora-tenant": TENANT } });
    expect(response.status).toBe(200);
    const { url, headers } = sent();
    expect(url).toBe("http://api.test/v1/patient/me");
    expect(headers.get("x-medora-brand-host")).toBe("app.kestrel.test");
    expect(headers.get("x-medora-tenant")).toBe(BRAND_TENANT);
  });

  it("lets nothing keep a patient reply", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }, { headers: { "cache-control": "public, max-age=600" } }));
    const response = await call(["patient", "me"], { headers: PATIENT_HOST });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reaches no route but the patient ones", async () => {
    for (const path of [["staff"], ["me"], ["patients"], ["public", "brands"]]) {
      expect((await call(path, { headers: PATIENT_HOST })).status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a host that isn't a brand's, and says so when the brand can't be found", async () => {
    brand.state = "unknown";
    expect((await call(["patient", "me"], { headers: PATIENT_HOST })).status).toBe(404);
    brand.state = "failed";
    expect((await call(["patient", "me"], { headers: PATIENT_HOST })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses without a patient session", async () => {
    token.value = null;
    expect((await call(["patient", "me"], { headers: PATIENT_HOST })).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("relay on the console", () => {
  it("never reaches a patient route", async () => {
    const response = await call(["patient", "me"], { headers: { "x-medora-tenant": TENANT } });
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("inertHeaders", () => {
  it("passes only the headers the page needs, always nosniff", () => {
    const headers = inertHeaders(new Headers({ "content-type": "application/json", "set-cookie": "a=b", server: "fastify", "retry-after": "5" }));
    expect(Object.fromEntries(headers)).toEqual({ "content-type": "application/json", "retry-after": "5", "x-content-type-options": "nosniff" });
  });

  it("sandboxes a type a browser could run script from", () => {
    for (const type of ["text/html; charset=utf-8", "image/svg+xml", "application/xhtml+xml"]) {
      expect(inertHeaders(new Headers({ "content-type": type })).get("content-security-policy")).toBe("sandbox");
    }
    expect(inertHeaders(new Headers({ "content-type": "application/pdf" })).get("content-security-policy")).toBeNull();
  });
});
