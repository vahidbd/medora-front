import { describe, expect, it } from "vitest";
import { addDays, nextCheckIn } from "@/lib/check-in-due";
import { formatReading, kindsToTrack, readingGroups } from "@/lib/measurement-kinds";
import { formatCalendarDay, formatShortDay } from "@/lib/format";
import { formatDateTimeIn, instantOn } from "@/lib/patient-time";

const weekly = [{ checkInEveryDays: 7 }];

describe("nextCheckIn (TRK6)", () => {
  it("is due the cadence's number of days after the last check-in, on the patient's calendar", () => {
    // Sent at 20:30 on the 15th in Sydney; at 23:00 on the 21st there, it is due tomorrow.
    const due = nextCheckIn({
      programs: weekly,
      lastSubmittedAt: "2026-11-15T09:30:00.000Z",
      createdAt: "2026-11-01T00:00:00.000Z",
      timeZone: "Australia/Sydney",
      now: new Date("2026-11-21T12:00:00.000Z"),
    });
    expect(due).toEqual({ dueOn: "2026-11-22", isDue: false });
  });

  it("counts from the patient's day, not UTC's", () => {
    // 23:30 UTC on the 14th is 10:30 on the 15th in Sydney.
    const due = nextCheckIn({ programs: weekly, lastSubmittedAt: "2026-11-14T23:30:00.000Z", createdAt: "2026-11-01T00:00:00.000Z", timeZone: "Australia/Sydney", now: new Date("2026-11-21T14:00:00.000Z") });
    // 14:00 UTC on the 21st is 01:00 on the 22nd in Sydney: due.
    expect(due).toEqual({ dueOn: "2026-11-22", isDue: true });
  });

  it("counts from when the account was made until the first check-in, and takes the shortest cadence", () => {
    const due = nextCheckIn({
      programs: [{ checkInEveryDays: 14 }, { checkInEveryDays: null }, { checkInEveryDays: 7 }],
      lastSubmittedAt: null,
      createdAt: "2026-11-02T01:15:00.000Z",
      timeZone: "Australia/Perth",
      now: new Date("2026-11-20T01:00:00.000Z"),
    });
    expect(due).toEqual({ dueOn: "2026-11-09", isDue: true });
  });

  it("has nothing to say when no program sets a cadence", () => {
    expect(nextCheckIn({ programs: [{ checkInEveryDays: null }], lastSubmittedAt: null, createdAt: "2026-11-02T01:15:00.000Z", timeZone: "Australia/Sydney", now: new Date() })).toBeNull();
    expect(nextCheckIn({ programs: [], lastSubmittedAt: null, createdAt: "2026-11-02T01:15:00.000Z", timeZone: "Australia/Sydney", now: new Date() })).toBeNull();
  });

  it("adds days across a month and a year", () => {
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
  });
});

describe("kindsToTrack (TRK1)", () => {
  it("takes the programs' kinds and anything already recorded, in one order, ignoring names it doesn't know", () => {
    const kinds = kindsToTrack([{ measurements: ["waist", "made_up_kind", "weight"] }], [{ kind: "heart_rate" }, { kind: "weight" }]);
    expect(kinds).toEqual(["weight", "waist", "heart_rate"]);
  });

  it("always gives both blood pressure numbers, together in one field group", () => {
    const kinds = kindsToTrack([{ measurements: ["blood_pressure"] }], []);
    expect(kinds).toEqual(["blood_pressure_systolic", "blood_pressure_diastolic"]);
    expect(kindsToTrack([{ measurements: ["blood_pressure_diastolic"] }], [])).toEqual(kinds);
    expect(readingGroups(["weight", ...kinds])).toEqual([{ kind: "single", measurement: "weight" }, { kind: "blood_pressure" }]);
  });

  it("reads a value in its unit, to the kind's decimals", () => {
    expect(formatReading("weight", 92)).toBe("92.0 kg");
    expect(formatReading("blood_pressure_systolic", 128)).toBe("128 mmHg");
  });
});

describe("patient calendar times (ADR 0017)", () => {
  it("finds noon on a day where the patient is, across daylight saving", () => {
    expect(instantOn("2026-11-18", "12:00", "Australia/Sydney").toISOString()).toBe("2026-11-18T01:00:00.000Z");
    expect(instantOn("2026-06-18", "12:00", "Australia/Sydney").toISOString()).toBe("2026-06-18T02:00:00.000Z");
    expect(instantOn("2026-11-18", "12:00", "Australia/Perth").toISOString()).toBe("2026-11-18T04:00:00.000Z");
  });

  it("writes days and times the Australian way", () => {
    expect(formatCalendarDay("2026-11-26")).toBe("Thu 26 Nov");
    expect(formatShortDay("2026-11-13")).toBe("13 Nov");
    expect(formatDateTimeIn("2026-11-12T20:30:00.000Z", "Australia/Sydney")).toBe("13 Nov 2026, 07:30");
  });
});
