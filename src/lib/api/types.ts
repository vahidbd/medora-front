import type { paths } from "./schema";

/*
 * Names for the API's shapes, all taken from the generated contract
 * (schema.d.ts, ADR 0014). A shape the API changes changes here at once,
 * and the type check finds every screen it touches.
 */

type Json<T> = T extends { content: { "application/json": infer Body } } ? Body : never;
type Reply<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends { responses: { 200: infer R } }
  ? Json<R>
  : never;
type RequestBody<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends {
  requestBody?: { content: { "application/json": infer Body } };
}
  ? Body
  : never;

/** The signed-in person and the tenants they belong to (GET /v1/me). */
export type Me = Reply<"/v1/me", "get">;
export type Membership = Me["memberships"][number];
export type Role = Membership["role"];
export type MembershipStatus = Membership["status"];
export type Permission = Membership["permissions"][number];

/** A tenant's staff (GET /v1/staff). */
export type StaffMember = Reply<"/v1/staff", "get">["staff"][number];
export type MembershipChange = RequestBody<"/v1/staff/{membershipId}", "patch">;

/** Clinicians and their standing (GET /v1/clinicians, GET /v1/clinicians/:clinicianId). */
export type ClinicianSummary = Reply<"/v1/clinicians", "get">["clinicians"][number];
export type ClinicianDetail = Reply<"/v1/clinicians/{clinicianId}", "get">;
export type Standing = ClinicianSummary["standing"];
export type StandingReason = Standing["reasons"][number];
export type StandingWarning = Standing["warnings"][number];
export type Profession = ClinicianSummary["profession"];
export type Credential = NonNullable<ClinicianDetail["credentials"]>[number];
export type HoursBlock = ClinicianDetail["hours"][number];
export type TimeOff = ClinicianDetail["timeOff"][number];
export type NewClinician = RequestBody<"/v1/clinicians", "post">;
export type NewCredential = RequestBody<"/v1/clinicians/{clinicianId}/credentials", "post">;
export type NewTimeOff = RequestBody<"/v1/clinicians/{clinicianId}/time-off", "post">;
export type SuspensionReason = RequestBody<"/v1/clinicians/{clinicianId}/suspend", "post">["reason"];
export type TimeOffReason = TimeOff["reason"];
