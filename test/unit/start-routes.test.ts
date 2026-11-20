import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ value: "patient-session" as string | null }));
vi.mock("@/lib/server/backend", () => ({
  backendApiUrl: (path: string) => `http://api.test/v1${path}`,
  backendToken: async () => session.value,
}));

const TENANT = "10000000-0000-4000-8000-000000000001";
const BRAND = "30000000-0000-4000-8000-000000000001";
vi.mock("@/lib/server/brand", () => ({
  brandLookup: async (host: string) =>
    host === "kestrel.test" ? { state: "found", brand: { tenantId: "10000000-0000-4000-8000-000000000001", brandId: "30000000-0000-4000-8000-000000000001" } } : { state: "unknown" },
}));

const { answerHeldStep, claimHeld, createAccount, readHeldIntake, startIntake } = await import("@/lib/server/intake");
const { INTAKE_COOKIE, MAX_HELD, readHeld, withHeld, writeHeld } = await import("@/lib/server/intake-tokens");

const INTAKE = "60000000-0000-4000-8000-000000000001";
const OTHER = "60000000-0000-4000-8000-000000000002";
const PROGRAM = "50000000-0000-4000-8000-000000000001";
const TOKEN = "a".repeat(43);
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  session.value = "patient-session";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function view(overrides: Record<string, unknown> = {}) {
  return { intakeId: INTAKE, programId: PROGRAM, status: "in_progress", endedReason: null, ...overrides };
}

function call(path: string, init: { method?: string; body?: unknown; held?: string; host?: string | null; type?: string } = {}) {
  const headers = new Headers();
  if (init.host !== null) headers.set("x-medora-brand-host", init.host ?? "kestrel.test");
  if (init.held !== undefined) headers.set("cookie", `${INTAKE_COOKIE}=${init.held}`);
  if (init.body !== undefined) headers.set("content-type", init.type ?? "application/json");
  return new NextRequest(`http://kestrel.test${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function sent(index = 0): { url: string; headers: Headers; body: unknown } {
  const [url, init] = fetchMock.mock.calls[index] ?? [];
  return { url: String(url), headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

function setCookie(response: NextResponse): string {
  return response.headers.get("set-cookie") ?? "";
}

const held = (...ids: string[]) => writeHeld(ids.map((intakeId) => ({ intakeId, programId: PROGRAM, token: TOKEN })));

describe("the held intakes cookie", () => {
  it("reads only well-formed entries, and the newest copy of each intake", () => {
    const value = [`${INTAKE}~${PROGRAM}~${TOKEN}`, "not-an-entry", `${OTHER}~${PROGRAM}~short`, `${INTAKE}~${PROGRAM}~${"b".repeat(43)}`].join(".");
    expect(readHeld(value)).toEqual([{ intakeId: INTAKE, programId: PROGRAM, token: "b".repeat(43) }]);
    expect(readHeld(undefined)).toEqual([]);
  });

  it("keeps the newest 20, and stays inside one cookie", () => {
    let list = readHeld("");
    for (let n = 0; n < MAX_HELD + 3; n++) {
      list = withHeld(list, { intakeId: `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`, programId: PROGRAM, token: "x".repeat(43) });
    }
    expect(list).toHaveLength(MAX_HELD);
    expect(list[0]?.intakeId.endsWith("000000000003")).toBe(true);
    expect(`${INTAKE_COOKIE}=${writeHeld(list)}`.length).toBeLessThan(4096);
    expect(readHeld(writeHeld(list))).toEqual(list);
  });
});

describe("starting an intake", () => {
  it("moves the token from the API's header into the cookie, and never shows it to the page", async () => {
    fetchMock.mockResolvedValue(Response.json(view(), { status: 201, headers: { "x-medora-intake-token": TOKEN } }));
    const response = await startIntake(call("/api/start/intakes", { method: "POST", body: { programId: PROGRAM } }));

    expect(response.status).toBe(201);
    expect(response.headers.get("x-medora-intake-token")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(text).not.toContain(TOKEN);
    const cookie = setCookie(response);
    expect(cookie).toContain(`${INTAKE_COOKIE}=${INTAKE}~${PROGRAM}~${TOKEN};`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);

    const { url, headers } = sent();
    expect(url).toBe("http://api.test/v1/public/intakes");
    expect(headers.get("x-medora-tenant")).toBe(TENANT);
    expect(headers.get("authorization")).toBeNull();
  });

  it("adds to what the browser already holds", async () => {
    fetchMock.mockResolvedValue(Response.json(view({ intakeId: OTHER }), { status: 201, headers: { "x-medora-intake-token": "c".repeat(43) } }));
    const response = await startIntake(call("/api/start/intakes", { method: "POST", body: {}, held: held(INTAKE) }));
    const value = /__Host-medora-intake=([^;]*)/.exec(setCookie(response))?.[1];
    expect(readHeld(value).map((h) => h.intakeId)).toEqual([INTAKE, OTHER]);
  });

  it("passes a refusal on as it came, and holds nothing", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "brand_not_accepting", message: "Not taking new patients" } }, { status: 409 }));
    const response = await startIntake(call("/api/start/intakes", { method: "POST", body: {} }));
    expect(response.status).toBe(409);
    expect(setCookie(response)).toBe("");
  });

  it("answers nothing on the console, or for a body that isn't JSON", async () => {
    expect((await startIntake(call("/api/start/intakes", { method: "POST", body: {}, host: null }))).status).toBe(404);
    expect((await startIntake(call("/api/start/intakes", { method: "POST", body: {}, type: "text/plain" }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("an intake the browser holds", () => {
  it("is read with the token from the cookie", async () => {
    fetchMock.mockResolvedValue(Response.json(view()));
    const response = await readHeldIntake(call(`/api/start/intakes/${INTAKE}`, { held: held(INTAKE) }), INTAKE);
    expect(response.status).toBe(200);
    expect(sent().url).toBe(`http://api.test/v1/public/intakes/${INTAKE}`);
    expect(sent().headers.get("x-medora-intake-token")).toBe(TOKEN);
  });

  it("isn't found when the browser doesn't hold it, and the API is never asked", async () => {
    const response = await readHeldIntake(call(`/api/start/intakes/${OTHER}`, { held: held(INTAKE) }), OTHER);
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the cookie 14 days from each answer saved", async () => {
    fetchMock.mockResolvedValue(Response.json(view()));
    const response = await answerHeldStep(call(`/api/start/intakes/${INTAKE}/steps/body`, { method: "PUT", body: { answers: {} }, held: held(INTAKE) }), INTAKE, "body");
    expect(sent().url).toBe(`http://api.test/v1/public/intakes/${INTAKE}/steps/body`);
    expect(setCookie(response)).toMatch(/Max-Age=1209600/);
  });

  it("is dropped once it has lapsed, or its token no longer finds it", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(view({ status: "ended", endedReason: "unclaimed" })));
    const lapsed = await readHeldIntake(call(`/api/start/intakes/${INTAKE}`, { held: held(INTAKE, OTHER) }), INTAKE);
    expect(readHeld(/__Host-medora-intake=([^;]*)/.exec(setCookie(lapsed))?.[1]).map((h) => h.intakeId)).toEqual([OTHER]);

    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "not_found", message: "Intake not found" } }, { status: 404 }));
    const gone = await readHeldIntake(call(`/api/start/intakes/${INTAKE}`, { held: held(INTAKE) }), INTAKE);
    expect(setCookie(gone)).toMatch(/Max-Age=0/);
  });

  it("is kept after a hard stop, so it is claimed with the rest (INT6)", async () => {
    fetchMock.mockResolvedValue(Response.json(view({ status: "ineligible" })));
    const response = await answerHeldStep(call(`/api/start/intakes/${INTAKE}/steps/health`, { method: "PUT", body: { answers: {} }, held: held(INTAKE) }), INTAKE, "health");
    expect(setCookie(response)).toContain(INTAKE);
    expect(setCookie(response)).not.toMatch(/Max-Age=0/);
  });

  it("refuses a step key that isn't one", async () => {
    const response = await answerHeldStep(call(`/api/start/intakes/${INTAKE}/steps/x`, { method: "PUT", body: {}, held: held(INTAKE) }), INTAKE, "../../x");
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("claiming", () => {
  it("sends every held token with the session, and clears the cookie once claimed", async () => {
    fetchMock.mockResolvedValue(Response.json({ claimed: [INTAKE, OTHER] }));
    const response = await claimHeld(call("/api/start/claim", { method: "POST", body: {}, held: held(INTAKE, OTHER) }));
    expect(response.status).toBe(200);
    expect(sent().url).toBe("http://api.test/v1/patient/intakes/claim");
    expect(sent().headers.get("authorization")).toBe("Bearer patient-session");
    expect(sent().body).toEqual({ tokens: [TOKEN, TOKEN] });
    expect(setCookie(response)).toMatch(/Max-Age=0/);
  });

  it("keeps the cookie when the API refuses, for the next try", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { code: "date_of_birth_needed", message: "Confirm" } }, { status: 403 }));
    const response = await claimHeld(call("/api/start/claim", { method: "POST", body: {}, held: held(INTAKE) }));
    expect(response.status).toBe(403);
    expect(setCookie(response)).toBe("");
  });

  it("does nothing without a session, or with nothing held", async () => {
    session.value = null;
    expect((await claimHeld(call("/api/start/claim", { method: "POST", body: {}, held: held(INTAKE) }))).status).toBe(401);
    session.value = "patient-session";
    const none = await claimHeld(call("/api/start/claim", { method: "POST", body: {} }));
    expect(await none.json()).toEqual({ claimed: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("creating an account", () => {
  it("names this host's brand whatever the page sent, then claims what the browser holds", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ patientId: "p" }, { status: 201 }));
    fetchMock.mockResolvedValueOnce(Response.json({ claimed: [INTAKE] }));
    const body = { givenName: "Sam", brandId: "30000000-0000-4000-8000-000000000009" };
    const response = await createAccount(call("/api/start/account", { method: "POST", body, held: held(INTAKE) }));

    expect(response.status).toBe(201);
    expect(sent(0).url).toBe("http://api.test/v1/patient/account");
    expect(sent(0).body).toEqual({ givenName: "Sam", brandId: BRAND });
    expect(sent(1).url).toBe("http://api.test/v1/patient/intakes/claim");
    expect(setCookie(response)).toMatch(/Max-Age=0/);
  });

  it("keeps the account and the cookie when the claim fails", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ patientId: "p" }, { status: 201 }));
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "internal_error", message: "x" } }, { status: 500 }));
    const response = await createAccount(call("/api/start/account", { method: "POST", body: {}, held: held(INTAKE) }));
    expect(response.status).toBe(201);
    expect(setCookie(response)).toBe("");
  });

  it("passes a refusal on, and claims nothing", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "brand_not_accepting", message: "x" } }, { status: 409 }));
    const response = await createAccount(call("/api/start/account", { method: "POST", body: {}, held: held(INTAKE) }));
    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
