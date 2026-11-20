import { request } from "./client";
import type { ClinicianDetail, ClinicianSummary, HoursBlock, NewClinician, NewCredential, NewTimeOff, SuspensionReason, TimeOff } from "./types";

const at = (clinicianId: string, rest = "") => `/clinicians/${encodeURIComponent(clinicianId)}${rest}`;

/** Clinicians, their credentials, hours and time off (the API's docs/decisions/workforce.md). */
export const cliniciansApi = {
  list: async (tenant: string) => (await request<{ clinicians: ClinicianSummary[] }>("/clinicians", { tenant })).clinicians,
  get: (tenant: string, clinicianId: string) => request<ClinicianDetail>(at(clinicianId), { tenant }),
  create: (tenant: string, body: NewClinician) => request<ClinicianDetail>("/clinicians", { method: "POST", body, tenant }),
  suspend: (tenant: string, clinicianId: string, reason: SuspensionReason) =>
    request<ClinicianDetail>(at(clinicianId, "/suspend"), { method: "POST", body: { reason }, tenant }),
  resume: (tenant: string, clinicianId: string) => request<ClinicianDetail>(at(clinicianId, "/resume"), { method: "POST", tenant }),
  addCredential: (tenant: string, clinicianId: string, body: NewCredential) =>
    request<ClinicianDetail>(at(clinicianId, "/credentials"), { method: "POST", body, tenant }),
  credentialAction: (tenant: string, clinicianId: string, credentialId: string, action: "verify" | "review-conditions") =>
    request<ClinicianDetail>(at(clinicianId, `/credentials/${encodeURIComponent(credentialId)}/${action}`), { method: "POST", tenant }),
  withdrawCredential: (tenant: string, clinicianId: string, credentialId: string, reason: "entered_in_error" | "no_longer_held") =>
    request<ClinicianDetail>(at(clinicianId, `/credentials/${encodeURIComponent(credentialId)}/withdraw`), { method: "POST", body: { reason }, tenant }),
  replaceHours: async (tenant: string, clinicianId: string, hours: HoursBlock[]) =>
    (await request<{ hours: HoursBlock[] }>(at(clinicianId, "/hours"), { method: "PUT", body: { hours }, tenant })).hours,
  addTimeOff: (tenant: string, clinicianId: string, body: NewTimeOff) =>
    request<TimeOff>(at(clinicianId, "/time-off"), { method: "POST", body, tenant }),
  removeTimeOff: (tenant: string, clinicianId: string, timeOffId: string) =>
    request<{ removed: true }>(at(clinicianId, `/time-off/${encodeURIComponent(timeOffId)}`), { method: "DELETE", tenant }),
};
