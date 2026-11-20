import { describe, expect, it } from "vitest";
import { accessStateOf, dayOf, endOfDay, isUsable } from "@/lib/staff-access";

const NOW = Date.parse("2026-11-20T04:00:00Z");
const member = (over: Partial<Parameters<typeof accessStateOf>[0]>) => ({
  status: "active" as const,
  expiresAt: null,
  invitationExpiresAt: null,
  ...over,
});

describe("where a membership stands (ADM9)", () => {
  it("tells an open invitation from an expired one", () => {
    expect(accessStateOf(member({ status: "invited", invitationExpiresAt: "2026-11-21T00:00:00Z" }), NOW)).toBe("invited");
    expect(accessStateOf(member({ status: "invited", invitationExpiresAt: "2026-11-19T00:00:00Z" }), NOW)).toBe("invitation_expired");
  });

  it("ends a membership at its end date, whatever its status", () => {
    expect(accessStateOf(member({ expiresAt: "2026-11-20T03:59:59Z" }), NOW)).toBe("ended");
    expect(accessStateOf(member({ status: "suspended", expiresAt: "2026-11-19T00:00:00Z" }), NOW)).toBe("ended");
    expect(accessStateOf(member({ expiresAt: "2026-12-01T00:00:00Z" }), NOW)).toBe("active");
    expect(accessStateOf(member({ status: "suspended" }), NOW)).toBe("paused");
  });

  it("lets the console work only in an active membership before its end", () => {
    expect(isUsable({ status: "active", expiresAt: null }, NOW)).toBe(true);
    expect(isUsable({ status: "active", expiresAt: "2026-11-20T04:00:00Z" }, NOW)).toBe(false);
    expect(isUsable({ status: "invited", expiresAt: null }, NOW)).toBe(false);
  });
});

describe("end dates are days (ADM11)", () => {
  it("ends at the last second of the day picked, and reads back as that day", () => {
    const instant = endOfDay("2026-12-31");
    const local = new Date(instant);
    expect([local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes()]).toEqual([2026, 11, 31, 23, 59]);
    expect(dayOf(instant)).toBe("2026-12-31");
    expect(dayOf(null)).toBe("");
  });
});
