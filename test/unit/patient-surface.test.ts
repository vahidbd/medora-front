import { describe, expect, it } from "vitest";
import { brandFromHeader, brandHeaderValue, type Brand } from "@/lib/brand";
import { brandColours, brandStyleRule, contrastRatio } from "@/lib/brand-colour";
import { dateIn, greetingFor } from "@/lib/patient-time";
import { consoleHostsFrom, isPatientFilePath, normaliseHost, patientPath, surfaceOf } from "@/lib/surface";

const BRAND: Brand = {
  brandId: "30000000-0000-4000-8000-000000000001",
  tenantId: "10000000-0000-4000-8000-000000000001",
  name: "Kestrel Ōra (demo)",
  status: "live",
  logoUrl: null,
  primaryColour: "#0f766e",
  supportEmail: "help@kestrel.example.test",
  supportPhone: null,
  timeZone: "Australia/Sydney",
};

describe("the surface a host serves", () => {
  it("reads the Host header as a plain host name, or not at all", () => {
    expect(normaliseHost("App.Kestrel.example:443")).toBe("app.kestrel.example");
    expect(normaliseHost("app.kestrel.example.")).toBe("app.kestrel.example");
    for (const bad of ["", "  ", "a b", "evil.test/x", "user@evil.test", "-bad.test", "[::1]:3000"]) expect(normaliseHost(bad)).toBeNull();
  });

  it("serves the console on its hosts and a brand's patient app on every other", () => {
    const consoleHosts = consoleHostsFrom("console.example.test, ADMIN.example.test");
    expect(surfaceOf("console.example.test", consoleHosts)).toBe("console");
    expect(surfaceOf("admin.example.test", consoleHosts)).toBe("console");
    expect(surfaceOf("localhost", consoleHosts)).toBe("patient");
    expect(surfaceOf("app.kestrel.example", consoleHosts)).toBe("patient");
    expect(surfaceOf(null, consoleHosts)).toBeNull();
  });

  it("uses localhost for the console when CONSOLE_HOSTS names none", () => {
    expect(consoleHostsFrom(undefined)).toEqual(["localhost", "127.0.0.1"]);
    expect(consoleHostsFrom(" , ")).toEqual(["localhost", "127.0.0.1"]);
  });

  it("rewrites a patient address into the patient tree, which is never served at its own", () => {
    expect(patientPath("/")).toBe("/patient");
    expect(patientPath("/home")).toBe("/patient/home");
    expect(isPatientFilePath("/patient")).toBe(true);
    expect(isPatientFilePath("/patient/home")).toBe(true);
    expect(isPatientFilePath("/patients")).toBe(false);
  });
});

describe("the brand the proxy hands to a page", () => {
  it("survives the header, names that aren't ASCII included", () => {
    const value = brandHeaderValue(BRAND);
    expect(value).toMatch(/^[\x20-\x7e]+$/);
    expect(brandFromHeader(value)).toEqual(BRAND);
  });

  it("is nothing when missing or not a brand", () => {
    expect(brandFromHeader(null)).toBeNull();
    expect(brandFromHeader("%E0%A4%A")).toBeNull();
    expect(brandFromHeader(encodeURIComponent(JSON.stringify({ ...BRAND, status: "draft" })))).toBeNull();
  });
});

describe("a brand's colour", () => {
  it("measures contrast the WCAG way", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#777777"), 10);
  });

  it("replaces the kit's primary with ink that reaches 4.5:1 on it", () => {
    const teal = brandColours("#0F766E");
    expect(teal).toMatchObject({ primary: "#0f766e", foreground: "#ffffff" });
    expect(contrastRatio(teal!.primary, teal!.foreground)).toBeGreaterThanOrEqual(4.5);
    expect(brandColours("#facc15")).toMatchObject({ foreground: "#0a0a0a" });
  });

  it("keeps the kit's primary for a colour that isn't a #rrggbb", () => {
    for (const bad of [null, "", "teal", "#fff", "#0f766e;}body{display:none", "url(x)"]) expect(brandColours(bad)).toBeNull();
  });

  it("writes a rule with only the checked values", () => {
    expect(brandStyleRule(brandColours("#0f766e")!)).toMatch(/^html:root,html\.dark\{--primary:#[0-9a-f]{6};--primary-foreground:#[0-9a-f]{6};--primary-hover:#[0-9a-f]{6};\}$/);
  });
});

describe("a patient's day", () => {
  it("is where the patient is", () => {
    const at = new Date("2026-11-20T13:30:00Z");
    expect(dateIn(at, "Australia/Sydney")).toBe("2026-11-21");
    expect(dateIn(at, "Australia/Perth")).toBe("2026-11-20");
    expect(greetingFor(at, "Australia/Sydney")).toBe("Good morning");
    expect(greetingFor(at, "Australia/Perth")).toBe("Good evening");
  });
});
