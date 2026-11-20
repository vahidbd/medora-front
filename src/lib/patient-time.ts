import { formatCalendarDate } from "@/lib/format";

/*
 * "Today" on a patient's screens is the day where the patient is (ADR
 * 0017). Until a patient's own zone is known, it is their tenant's.
 */

/** The hour, 0 to 23, at an instant in a time zone. */
export function hourIn(at: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone }).format(at);
  return Number(hour) % 24;
}

/** "Good morning", "Good afternoon" or "Good evening" where the patient is. */
export function greetingFor(at: Date, timeZone: string): string {
  const hour = hourIn(at, timeZone);
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The calendar date, YYYY-MM-DD, at an instant in a time zone. */
export function dateIn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The wall clock in a time zone at an instant, read as if it were UTC. */
function wallClockOf(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour") % 24, part("minute"));
}

/** The instant a time of day ("12:00") falls on a calendar day (YYYY-MM-DD) in a time zone. */
export function instantOn(day: string, time: string, timeZone: string): Date {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  return new Date(guess - (wallClockOf(new Date(guess), timeZone) - guess));
}

/** "13 Nov 2026, 07:30" where the patient is. */
export function formatDateTimeIn(at: Date | string, timeZone: string): string {
  const instant = typeof at === "string" ? new Date(at) : at;
  const time = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(instant);
  return `${formatCalendarDate(dateIn(instant, timeZone))}, ${time}`;
}
