import { request } from "./client";
import type {
  ConsentDocument,
  ConsentDocumentInput,
  ConsentRecord,
  IntakeSummary,
  ManualVerification,
  Patient,
  PatientConsent,
  PatientIdentity,
  PatientIntake,
  PatientListItem,
} from "./types";

const id = (value: string) => encodeURIComponent(value);

/**
 * Patients as staff see them (docs/decisions/patients.md IDN9). A search
 * travels in the request to the API and nowhere else: never in the page's
 * own address, because it carries a name.
 */
export const patientsApi = {
  list: async (tenant: string, search?: string) => {
    const query = search ? `?${new URLSearchParams({ search }).toString()}` : "";
    return (await request<{ patients: PatientListItem[] }>(`/patients${query}`, { tenant })).patients;
  },
  get: (tenant: string, patientId: string) => request<Patient>(`/patients/${id(patientId)}`, { tenant }),
  identity: (tenant: string, patientId: string) => request<PatientIdentity>(`/patients/${id(patientId)}/identity`, { tenant }),
  verifyManually: (tenant: string, patientId: string, input: ManualVerification) =>
    request<PatientIdentity>(`/patients/${id(patientId)}/identity/manual`, { method: "POST", body: input, tenant }),
  reopenIdentity: (tenant: string, patientId: string, reason: string) =>
    request<PatientIdentity>(`/patients/${id(patientId)}/identity/reopen`, { method: "POST", body: { reason }, tenant }),
  lookUpIhi: (tenant: string, patientId: string) => request<PatientIdentity>(`/patients/${id(patientId)}/ihi-lookup`, { method: "POST", tenant }),
  consents: async (tenant: string, patientId: string) =>
    (await request<{ consents: PatientConsent[] }>(`/patients/${id(patientId)}/consents`, { tenant })).consents,
  recordConsent: (tenant: string, patientId: string, input: ConsentRecord) =>
    request<{ consents: PatientConsent[] }>(`/patients/${id(patientId)}/consents`, { method: "POST", body: input, tenant }),
  intakes: async (tenant: string, patientId: string) =>
    (await request<{ intakes: PatientIntake[] }>(`/patients/${id(patientId)}/intakes`, { tenant })).intakes,
};

/** The prescriber's summary of one finished intake (INT15): audited by the API on every read. */
export const intakesApi = {
  summary: (tenant: string, intakeId: string) => request<IntakeSummary>(`/intakes/${id(intakeId)}`, { tenant }),
};

/** The tenant's consent documents, each version kept (IDN12 to IDN14). */
export const consentDocumentsApi = {
  list: async (tenant: string) => (await request<{ documents: ConsentDocument[] }>("/consent-documents", { tenant })).documents,
  publish: (tenant: string, input: ConsentDocumentInput) => request<ConsentDocument>("/consent-documents", { method: "POST", body: input, tenant }),
};
