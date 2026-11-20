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
type Created<Path extends keyof paths, Method extends keyof paths[Path]> = paths[Path][Method] extends { responses: { 201: infer R } }
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
export type StaffList = Reply<"/v1/staff", "get">;
export type SignIn = Reply<"/v1/me/sign-ins", "get">["signIns"][number];

/** Inviting someone (POST /v1/staff/invitations): the member, and whether the email went out. */
export type InvitationInput = RequestBody<"/v1/staff/invitations", "post">;
export type InvitationReply = Created<"/v1/staff/invitations", "post">;

/** Roles (GET /v1/roles): the starting roles, the tenant's custom roles and every permission with its zone. */
export type RolesReply = Reply<"/v1/roles", "get">;
export type StartingRole = RolesReply["startingRoles"][number];
export type StartingRoleKey = StartingRole["key"];
export type CustomRole = RolesReply["customRoles"][number];
export type DataZone = RolesReply["permissions"][number]["zone"];
export type RoleInput = RequestBody<"/v1/roles", "post">;
export type RoleUpdate = RequestBody<"/v1/roles/{roleId}", "patch">;

/** Break-glass (ADR 0220): opened by the person, reviewed by someone else. */
export type BreakGlassRecord = Reply<"/v1/break-glass", "get">["breakGlass"][number];

/** A brand, as its public pages see it (GET /v1/public/brands/by-host/{host}). */
export type PublicBrand = Reply<"/v1/public/brands/by-host/{host}", "get">;

/** The signed-in patient, to this brand's tenant (GET /v1/patient/me). */
export type PatientMe = Reply<"/v1/patient/me", "get">;
export type PatientProgram = PatientMe["programs"][number];
export type DateOfBirthConfirmation = RequestBody<"/v1/patient/confirm-date-of-birth", "post">;

/** What a patient records between consults (docs/decisions/tracking.md in medora-backend). */
export type Measurement = Reply<"/v1/patient/measurements", "get">["measurements"][number];
export type MeasurementKind = Measurement["kind"];
export type MeasurementUnit = Measurement["unit"];
export type Reading = RequestBody<"/v1/patient/measurements", "post">["readings"][number];
export type MeasurementsRecording = RequestBody<"/v1/patient/measurements", "post">;
export type MeasurementsRecorded = Created<"/v1/patient/measurements", "post">;
export type SideEffect = Reply<"/v1/patient/side-effects", "get">["sideEffects"][number];
export type SideEffectSeverity = SideEffect["severity"];
export type SideEffectReport = RequestBody<"/v1/patient/side-effects", "post">;
export type CheckIn = Reply<"/v1/patient/check-ins", "get">["checkIns"][number];
export type MissedDoses = CheckIn["missedDoses"];
export type CheckInSubmission = RequestBody<"/v1/patient/check-ins", "post">;

/** How a patient hears from their care (docs/decisions/notifications.md in medora-backend). */
export type NotificationPreferences = Reply<"/v1/patient/notification-preferences", "get">;
/** A tenant's set-up (docs/decisions/admin.md ADM14 to ADM20). */
export type TenantSettings = Reply<"/v1/tenant", "get">;
export type TenantSettingsChange = RequestBody<"/v1/tenant", "patch">;
export type TimeZone = TenantSettings["timeZone"];
export type Onboarding = Reply<"/v1/tenant/onboarding", "get">;
export type OnboardingItem = Onboarding["items"][number]["key"];
export type Company = Reply<"/v1/companies", "get">["companies"][number];
export type AuState = Company["state"];
export type CompanyInput = RequestBody<"/v1/companies", "post">;
export type CompanyChange = RequestBody<"/v1/companies/{companyId}", "patch">;
export type Brand = Reply<"/v1/brands", "get">["brands"][number];
export type BrandStatus = Brand["status"];
export type BrandDomain = Brand["domains"][number];
export type BrandInput = RequestBody<"/v1/brands", "post">;
export type BrandChange = RequestBody<"/v1/brands/{brandId}", "patch">;

/** Platform staff's screens (ADM14, ADM15). */
export type PlatformTenant = Reply<"/v1/platform/tenants", "get">["tenants"][number];
export type TenantInput = RequestBody<"/v1/platform/tenants", "post">;
export type TenantCreated = Created<"/v1/platform/tenants", "post">;
export type OwnerInvitationReply = Reply<"/v1/platform/tenants/{tenantId}/owner-invitation", "post">;
export type PlatformDomain = Reply<"/v1/platform/domains", "get">["domains"][number];

// The catalogue and Medora's block rules (docs/decisions/catalogue.md CAT1 to CAT5).
export type Product = Reply<"/v1/products", "get">["products"][number];
export type ProductKind = Product["kind"];
export type Schedule = NonNullable<Product["schedule"]>;
export type Storage = Product["storage"];
export type ProductStatus = Product["status"];
export type ProductBlock = NonNullable<Product["blocked"]>;
export type ProductInput = RequestBody<"/v1/products", "post">;
export type ProductChange = RequestBody<"/v1/products/{productId}", "patch">;
export type BlockRule = Reply<"/v1/block-rules", "get">["rules"][number];
export type BlockRuleMatch = BlockRule["match"];
export type BlockRuleInput = RequestBody<"/v1/platform/block-rules", "post">;

/** The tenant's audit log (GET /v1/audit, POST /v1/audit/exports; docs/decisions/admin.md ADM25, ADM26). */
export type AuditPage = Reply<"/v1/audit", "get">;
export type AuditEntry = AuditPage["entries"][number];
export type AuditFilter = RequestBody<"/v1/audit/exports", "post">;
export type AuditExport = Reply<"/v1/audit/exports", "post">;
