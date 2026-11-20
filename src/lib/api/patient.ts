import { request } from "./client";
import type { DateOfBirthConfirmation, PatientMe } from "./types";

/*
 * The patient app's calls. Every one goes to /api/backend/patient/*, which
 * the relay forwards only from a brand's patient host, with the brand's
 * host and its tenant attached by the server (ADR 0037). No call names a
 * tenant.
 */

export const patientApi = {
  /** The patient's own details and programs. Refused until the account exists and this sign-in has confirmed the date of birth. */
  me: () => request<PatientMe>("/patient/me"),
  /** Asked once per new sign-in, before any other patient route answers (ADR 0035). */
  confirmDateOfBirth: (body: DateOfBirthConfirmation) =>
    request<{ confirmed: true }>("/patient/confirm-date-of-birth", { method: "POST", body }),
};

/** Every patient query starts with this, so one brand's answers can never stand in for another's. */
export function patientKey(host: string, ...rest: readonly unknown[]): readonly unknown[] {
  return ["patient", host, ...rest];
}
