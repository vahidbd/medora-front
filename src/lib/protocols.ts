import type { StatusTone } from "@/components/shared/status-badge";
import type { IntakeEndReason, IntakeStatus, IntakeSummary, MeasurementKind, ProgramStatus, ProtocolVersionStatus } from "@/lib/api/types";

/** Words for protocols, programs and intakes (docs/decisions/intake.md). */

export const VERSION_STATUS: Record<ProtocolVersionStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  live: { label: "Live", tone: "success" },
  retired: { label: "Retired", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "danger" },
};

export const PROGRAM_STATUS: Record<ProgramStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  live: { label: "Live", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  retired: { label: "Retired", tone: "neutral" },
};

export const MEASUREMENT_LABELS: Record<MeasurementKind, string> = {
  weight: "Weight",
  waist: "Waist",
  height: "Height",
  blood_pressure_systolic: "Blood pressure (systolic)",
  blood_pressure_diastolic: "Blood pressure (diastolic)",
  heart_rate: "Heart rate",
};

export const INTAKE_STATUS: Record<IntakeStatus, { label: string; tone: StatusTone }> = {
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  ineligible: { label: "Not eligible", tone: "warning" },
  ended: { label: "Ended", tone: "neutral" },
};

export const END_REASON_LABELS: Record<IntakeEndReason, string> = {
  under_age: "Under 18",
  version_withdrawn: "Its protocol version was withdrawn",
  expired: "No activity for 30 days",
  unclaimed: "Never claimed, answers cleared",
};

export const OUTCOME: Record<IntakeSummary["outcome"], { label: string; tone: StatusTone }> = {
  clear: { label: "No red flags", tone: "success" },
  red_flags: { label: "Red flags", tone: "warning" },
  ineligible: { label: "Not eligible", tone: "danger" },
};

/** The attestation the API stores with a sign-off (INT4), shown word for word before signing. */
export function attestationOf(protocolName: string, version: number, registration: string): string {
  return `I have reviewed version ${version} of the protocol "${protocolName}" and approve it for use with patients, under Ahpra registration ${registration || "MED…"}.`;
}

/** An Ahpra registration as a medical practitioner: MED and ten digits (INT4). */
export const REGISTRATION = /^MED\d{10}$/;
