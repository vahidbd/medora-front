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

/** Patients, identity and consent (docs/decisions/patients.md IDN1 to IDN20). */
export type PatientListItem = Reply<"/v1/patients", "get">["patients"][number];
export type Patient = Reply<"/v1/patients/{patientId}", "get">;
export type IdentityStatus = Patient["identityStatus"];
export type Sex = Patient["sex"];
export type PatientIdentity = Reply<"/v1/patients/{patientId}/identity", "get">;
export type IdentityCheck = PatientIdentity["checks"][number];
export type IdentityDocument = IdentityCheck["documentType"];
export type IhiStatus = NonNullable<NonNullable<PatientIdentity["ihi"]>["status"]>;
export type ManualVerification = RequestBody<"/v1/patients/{patientId}/identity/manual", "post">;
export type PatientConsent = Reply<"/v1/patients/{patientId}/consents", "get">["consents"][number];
export type ConsentRecord = RequestBody<"/v1/patients/{patientId}/consents", "post">;
export type ConsentDocument = Reply<"/v1/consent-documents", "get">["documents"][number];
export type ConsentKind = ConsentDocument["kind"];
export type ConsentDocumentInput = RequestBody<"/v1/consent-documents", "post">;

/** Protocols, programs and intakes (docs/decisions/intake.md INT1 to INT15). */
export type ProtocolTemplate = Reply<"/v1/protocol-templates", "get">["templates"][number];
export type ProtocolSummary = Reply<"/v1/protocols", "get">["protocols"][number];
export type ProtocolDetail = Reply<"/v1/protocols/{protocolId}", "get">;
export type ProtocolVersionSummary = ProtocolDetail["versions"][number];
export type ProtocolVersionStatus = ProtocolVersionSummary["status"];
export type ProtocolVersion = Reply<"/v1/protocols/{protocolId}/versions/{version}", "get">;
export type NewProtocol = RequestBody<"/v1/protocols", "post">;
export type SignOff = RequestBody<"/v1/protocols/{protocolId}/sign-off", "post">;
export type Program = Reply<"/v1/programs", "get">["programs"][number];
export type ProgramStatus = Program["status"];
export type MeasurementKind = Program["measurements"][number];
export type NewProgram = RequestBody<"/v1/programs", "post">;
export type ProgramChange = RequestBody<"/v1/programs/{programId}", "patch">;
export type PatientIntake = Reply<"/v1/patients/{patientId}/intakes", "get">["intakes"][number];
export type IntakeStatus = PatientIntake["status"];
export type IntakeEndReason = NonNullable<PatientIntake["endedReason"]>;
export type IntakeSummary = Reply<"/v1/intakes/{intakeId}", "get">;

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
