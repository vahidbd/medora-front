import { request } from "./client";
import type {
  CheckIn,
  CheckInSubmission,
  DateOfBirthConfirmation,
  Measurement,
  MeasurementsRecorded,
  MeasurementsRecording,
  NotificationPreferences,
  PatientMe,
  SideEffect,
  SideEffectReport,
} from "./types";

/*
 * The patient app's calls. Every one goes to /api/backend/patient/*, which
 * the relay forwards only from a brand's patient host, with the brand's
 * host and its tenant attached by the server (ADR 0180). No call names a
 * tenant.
 */

export const patientApi = {
  /** The patient's own details and programs. Refused until the account exists and this sign-in has confirmed the date of birth. */
  me: () => request<PatientMe>("/patient/me"),
  /** Asked once per new sign-in, before any other patient route answers (ADR 0100). */
  confirmDateOfBirth: (body: DateOfBirthConfirmation) =>
    request<{ confirmed: true }>("/patient/confirm-date-of-birth", { method: "POST", body }),

  /** Every kind, newest first. */
  measurements: () => request<{ measurements: Measurement[] }>("/patient/measurements"),
  /** Readings taken together, all written or none. */
  recordMeasurements: (body: MeasurementsRecording) =>
    request<MeasurementsRecorded>("/patient/measurements", { method: "POST", body }),
  sideEffects: () => request<{ sideEffects: SideEffect[] }>("/patient/side-effects"),
  reportSideEffect: (body: SideEffectReport) => request<SideEffect>("/patient/side-effects", { method: "POST", body }),
  /** Newest first, with the readings and side effect each one carried. */
  checkIns: () => request<{ checkIns: CheckIn[] }>("/patient/check-ins"),
  submitCheckIn: (body: CheckInSubmission) => request<CheckIn>("/patient/check-ins", { method: "POST", body }),

  notificationPreferences: () => request<NotificationPreferences>("/patient/notification-preferences"),
  setNotificationPreferences: (body: NotificationPreferences) =>
    request<NotificationPreferences>("/patient/notification-preferences", { method: "PUT", body }),
};

/** Every patient query starts with this, so one brand's answers can never stand in for another's. */
export function patientKey(host: string, ...rest: readonly unknown[]): readonly unknown[] {
  return ["patient", host, ...rest];
}
