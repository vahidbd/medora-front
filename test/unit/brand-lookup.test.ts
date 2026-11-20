import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/backend", () => ({ backendApiUrl: (path: string) => `http://api.test/v1${path}` }));

const { brandLookup, forgetBrands } = await import("@/lib/server/brand");

const BRAND = {
  brandId: "30000000-0000-4000-8000-000000000001",
  tenantId: "10000000-0000-4000-8000-000000000001",
  name: "Kestrel Health (demo)",
  status: "live",
  logoUrl: null,
  primaryColour: "#0f766e",
  supportEmail: null,
  supportPhone: null,
  timeZone: "Australia/Sydney",
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  forgetBrands();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("brandLookup", () => {
  it("asks the API's public brand route once a minute per host", async () => {
    fetchMock.mockResolvedValue(Response.json(BRAND));
    expect(await brandLookup("app.kestrel.test")).toEqual({ state: "found", brand: BRAND });
    expect(await brandLookup("app.kestrel.test")).toEqual({ state: "found", brand: BRAND });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("http://api.test/v1/public/brands/by-host/app.kestrel.test");
  });

  it("keeps an unknown host as unknown", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "not_found" } }, { status: 404 }));
    expect(await brandLookup("nobody.test")).toEqual({ state: "unknown" });
    expect(await brandLookup("nobody.test")).toEqual({ state: "unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never keeps a failure, so the next request asks again", async () => {
    fetchMock.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(Response.json(BRAND));
    expect(await brandLookup("app.kestrel.test")).toEqual({ state: "failed" });
    expect(await brandLookup("app.kestrel.test")).toEqual({ state: "found", brand: BRAND });
  });

  it("treats a reply that isn't a brand as a failure", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...BRAND, status: "draft" }));
    expect(await brandLookup("app.kestrel.test")).toEqual({ state: "failed" });
    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    expect(await brandLookup("app.kestrel.test")).toEqual({ state: "failed" });
  });
});
