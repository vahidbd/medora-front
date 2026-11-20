import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_IP_HEADER, CLIENT_IP_SIGNATURE_HEADER, clientIpHeaders, signClientIp } from "@/lib/server/client-ip";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const NOW = Date.UTC(2026, 10, 20, 0, 0, 0);

afterEach(() => vi.unstubAllEnvs());

describe("signClientIp", () => {
  it("signs the way the API checks (a vector from the API's own signer)", () => {
    expect(signClientIp("203.0.113.7", SECRET, NOW)).toBe("1795132800.RT1hwwP0qxnUEyQ57ynwvd7JRlQ6ekXZDhi4VbW95g8");
  });
});

describe("clientIpHeaders", () => {
  it("passes on the address the host's edge saw, signed", () => {
    vi.stubEnv("FORWARDED_IP_SECRET", SECRET);
    const headers = clientIpHeaders(new Headers({ "x-real-ip": "203.0.113.7" }), NOW);
    expect(headers).toEqual({
      [CLIENT_IP_HEADER]: "203.0.113.7",
      [CLIENT_IP_SIGNATURE_HEADER]: "1795132800.RT1hwwP0qxnUEyQ57ynwvd7JRlQ6ekXZDhi4VbW95g8",
    });
  });

  it("never trusts X-Forwarded-For, which a visitor can write", () => {
    vi.stubEnv("FORWARDED_IP_SECRET", SECRET);
    expect(clientIpHeaders(new Headers({ "x-forwarded-for": "198.51.100.1" }), NOW)).toEqual({});
  });

  it("sends nothing for a value that isn't an address", () => {
    vi.stubEnv("FORWARDED_IP_SECRET", SECRET);
    expect(clientIpHeaders(new Headers({ "x-real-ip": "not-an-address" }), NOW)).toEqual({});
  });

  it("sends nothing without a secret, or with one too short to trust", () => {
    expect(clientIpHeaders(new Headers({ "x-real-ip": "203.0.113.7" }), NOW)).toEqual({});
    vi.stubEnv("FORWARDED_IP_SECRET", "short");
    expect(clientIpHeaders(new Headers({ "x-real-ip": "203.0.113.7" }), NOW)).toEqual({});
  });
});
