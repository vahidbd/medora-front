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
