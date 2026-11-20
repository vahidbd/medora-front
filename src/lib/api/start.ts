import { request, requestAt } from "./client";
import type { AccountInput, AnonymousIntakeStart, IntakeAnswers, IntakeClaimed, IntakeView, PatientConsents, PatientIntakeList, PatientMe } from "./types";

/*
 * The start flow's calls (ADR 0280, docs/decisions/patient-start.md).
 *
 * Before an account, an intake goes through this app's own /api/start/*
 * routes, which hold its resume token in a cookie the page can't read; no
 * call here sees a token. Once signed in, the same intake is the patient's
 * own and goes through the relay to /v1/patient/intakes/*.
 */

/** What a patient sends to make their account; the server adds the brand, from the host (IDN20). */
export type AccountDetails = Omit<AccountInput, "brandId">;

export const startApi = {
  /** Start an intake before an account. The reply is the intake; its token stays on the server. */
  start: (body: AnonymousIntakeStart) => requestAt<IntakeView>("/api/start/intakes", { method: "POST", body }),
  /** An intake this browser holds. */
  read: (intakeId: string) => requestAt<IntakeView>(`/api/start/intakes/${encodeURIComponent(intakeId)}`),
  answer: (intakeId: string, stepKey: string, answers: IntakeAnswers) =>
    requestAt<IntakeView>(`/api/start/intakes/${encodeURIComponent(intakeId)}/steps/${encodeURIComponent(stepKey)}`, {
      method: "PUT",
      body: { answers },
    }),
  /** Create the account through this brand, and claim what the browser holds. */
  createAccount: (body: AccountDetails) => requestAt<PatientMe>("/api/start/account", { method: "POST", body }),
  /** Make every intake this browser holds the signed-in patient's own (INT6). */
  claim: () => requestAt<IntakeClaimed>("/api/start/claim", { method: "POST", body: {} }),
};

/** The patient's consents: what they have agreed to, and the current text of each (IDN12, IDN13). */
export const consentApi = {
  list: () => request<PatientConsents>("/patient/consents"),
  agree: (documentId: string) => request<PatientConsents>("/patient/consents", { method: "POST", body: { documentId } }),
};

export const patientIntakeApi = {
  list: () => request<PatientIntakeList>("/patient/intakes"),
  /** Start an intake, or get back the one in progress for that program. */
  start: (programId: string) => request<IntakeView>("/patient/intakes", { method: "POST", body: { programId } }),
  read: (intakeId: string) => request<IntakeView>(`/patient/intakes/${encodeURIComponent(intakeId)}`),
  answer: (intakeId: string, stepKey: string, answers: IntakeAnswers) =>
    request<IntakeView>(`/patient/intakes/${encodeURIComponent(intakeId)}/steps/${encodeURIComponent(stepKey)}`, {
      method: "PUT",
      body: { answers },
    }),
  submit: (intakeId: string) => request<IntakeView>(`/patient/intakes/${encodeURIComponent(intakeId)}/submit`, { method: "POST" }),
};
