import { describe, expect, it } from "vitest";
import { clerkOriginOf, contentSecurityPolicy, newNonce, originOf } from "@/lib/server/content-security-policy";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split("; ").map((part) => {
      const [name = "", ...values] = part.split(" ");
      return [name, values];
    }),
  );
}

const base = { nonce: "abc123", clerkOrigin: "https://clerk.example.test", sentryOrigin: null, development: false };

describe("contentSecurityPolicy", () => {
  it("runs only scripts carrying the nonce, and nothing can frame the app", () => {
    const policy = directives(contentSecurityPolicy(base));
    expect(policy.get("script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'", "https://clerk.example.test"]);
    expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
    expect(policy.get("script-src")).not.toContain("'unsafe-eval'");
    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.has("upgrade-insecure-requests")).toBe(true);
  });

  it("lets the page talk only to this app, Clerk and the error tracker", () => {
    const policy = directives(contentSecurityPolicy({ ...base, sentryOrigin: "https://o1.ingest.example.test" }));
    expect(policy.get("connect-src")).toEqual(["'self'", "https://clerk.example.test", "https://o1.ingest.example.test"]);
  });

  it("allows eval and plain http only under next dev", () => {
    const policy = directives(contentSecurityPolicy({ ...base, development: true }));
    expect(policy.get("script-src")).toContain("'unsafe-eval'");
    expect(policy.has("upgrade-insecure-requests")).toBe(false);
  });

  it("leaves Clerk out when there is no key", () => {
    const policy = directives(contentSecurityPolicy({ ...base, clerkOrigin: null }));
    expect(policy.get("script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(policy.get("connect-src")).toEqual(["'self'"]);
  });
});

describe("newNonce", () => {
  it("is 16 random bytes, new every time", () => {
    const first = newNonce();
    expect(Buffer.from(first, "base64")).toHaveLength(16);
    expect(newNonce()).not.toBe(first);
  });
});

describe("clerkOriginOf", () => {
  const key = (host: string, kind = "test") => `pk_${kind}_${Buffer.from(`${host}$`).toString("base64")}`;

  it("reads the Frontend API host from a publishable key", () => {
    expect(clerkOriginOf(key("clerk.example.test"))).toBe("https://clerk.example.test");
    expect(clerkOriginOf(key("clerk.example.test", "live"))).toBe("https://clerk.example.test");
  });

  it("refuses anything that isn't a plain host", () => {
    expect(clerkOriginOf(undefined)).toBeNull();
    expect(clerkOriginOf("pk_test_preview")).toBeNull();
    expect(clerkOriginOf(key("evil.test; script-src *"))).toBeNull();
    expect(clerkOriginOf("sk_test_abc")).toBeNull();
  });
});

describe("originOf", () => {
  it("keeps only https origins", () => {
    expect(originOf("https://key@o1.ingest.example.test/42")).toBe("https://o1.ingest.example.test");
    expect(originOf("http://o1.ingest.example.test/42")).toBeNull();
    expect(originOf("not a url")).toBeNull();
    expect(originOf(undefined)).toBeNull();
  });
});
