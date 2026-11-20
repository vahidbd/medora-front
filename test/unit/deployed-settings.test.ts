import { describe, expect, it } from "vitest";
import { unsafeSettings } from "@/lib/server/deployed-settings";

const PRODUCTION = {
  MEDORA_ENV: "production",
  BACKEND_URL: "https://api.example.test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
  CLERK_SECRET_KEY: "sk_live_abc",
  FORWARDED_IP_SECRET: "x".repeat(32),
  NEXT_PUBLIC_RELEASE_SHA: "0123456789abcdef0123456789abcdef01234567",
};

describe("unsafeSettings", () => {
  it("lets a production with every setting in place start", () => {
    expect(unsafeSettings(PRODUCTION)).toEqual([]);
  });

  it("checks nothing in development", () => {
    expect(unsafeSettings({ MEDORA_PREVIEW: "1" })).toEqual([]);
  });

  it("refuses development Clerk keys in production, and allows them on staging", () => {
    const testKeys = { ...PRODUCTION, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc", CLERK_SECRET_KEY: "sk_test_abc" };
    expect(unsafeSettings(testKeys)).toHaveLength(2);
    expect(unsafeSettings({ ...testKeys, MEDORA_ENV: "staging" })).toEqual([]);
  });

  it.each([
    ["preview mode", { MEDORA_PREVIEW: "1" }],
    ["a plain-http API", { BACKEND_URL: "http://api.example.test" }],
    ["no API address", { BACKEND_URL: undefined }],
    ["a short address secret", { FORWARDED_IP_SECRET: "short" }],
    ["an unknown release", { NEXT_PUBLIC_RELEASE_SHA: "development" }],
  ])("refuses %s", (_name, change) => {
    expect(unsafeSettings({ ...PRODUCTION, ...change })).toHaveLength(1);
  });
});
