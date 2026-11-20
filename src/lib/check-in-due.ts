import type { PatientProgram } from "@/lib/api/types";
import { dateIn } from "@/lib/patient-time";

/**
 * When the patient's next check-in is due (docs/decisions/tracking.md TRK6
 * in medora-backend): the shortest cadence among their programs, counted in
 * days from the last check-in, or from when the account was made, on the
 * patient's own calendar (ADR 0017). No program with a cadence, no check-in.
 */
export interface NextCheckIn {
  /** The calendar day it falls due, YYYY-MM-DD where the patient is. */
  dueOn: string;
  /** Due today or earlier. */
  isDue: boolean;
}

export function nextCheckIn(input: {
  programs: readonly Pick<PatientProgram, "checkInEveryDays">[];
  lastSubmittedAt: string | null;
  createdAt: string;
  timeZone: string;
  now: Date;
}): NextCheckIn | null {
  const cadences = input.programs.map((p) => p.checkInEveryDays).filter((days): days is number => days != null && days > 0);
  if (cadences.length === 0) return null;
  const from = dateIn(new Date(input.lastSubmittedAt ?? input.createdAt), input.timeZone);
  const dueOn = addDays(from, Math.min(...cadences));
  return { dueOn, isDue: dateIn(input.now, input.timeZone) >= dueOn };
}

/** A calendar date plus whole days, with no clock to shift it. */
export function addDays(day: string, days: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}
