import type { StatusTone } from "@/components/shared/status-badge";
import type { DataZone, MembershipStatus, Permission, Role, StartingRoleKey } from "@/lib/api/types";

/** How each starting role reads on a screen. The API's values stay as they are; the words come from here alone. */
export const ROLE_LABELS: Record<StartingRoleKey, string> = {
  owner: "Owner",
  admin: "Tenant admin",
  medical_director: "Medical director",
  prescriber: "Prescriber",
  clinician: "Clinician",
  support: "Support",
  finance: "Finance",
  operations: "Operations",
  marketing: "Marketing",
  compliance: "Compliance",
};

/** One line on who each starting role is for, shown where a role is chosen. */
export const ROLE_DESCRIPTIONS: Record<StartingRoleKey, string> = {
  owner: "Every permission. Clinical records only through break-glass.",
  admin: "Runs the tenant's setup: staff, roles and settings. No clinical data.",
  medical_director: "Clinical governance and protocol sign-off.",
  prescriber: "Doctors and nurse practitioners: sees patients and prescribes.",
  clinician: "Nurses, dietitians, psychologists and coaches: sees patients, no prescribing.",
  support: "Patient support: orders, billing, delivery and messages.",
  finance: "Money, with health data only as amounts and codes.",
  operations: "Orders, shipments and stock.",
  marketing: "Campaigns and leads. No clinical data.",
  compliance: "Approvals, privacy requests and the audit log.",
};

/** The role a membership has, as words: a custom role by its own name. */
export function roleName(member: { role: Role; customRole: { name: string } | null }): string {
  if (member.role === "custom") return member.customRole?.name ?? "Custom role";
  return ROLE_LABELS[member.role];
}

/** How each membership status reads, and its tone. Expired invitations and ended access are worked out in staff-access.ts. */
export const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Paused", tone: "neutral" },
  invited: { label: "Invited", tone: "info" },
};

/** What each permission lets a staff member do, in words. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "staff:read": "See the tenant's staff and roles",
  "staff:manage": "Invite staff and change their roles",
  "roles:manage": "Make and edit custom roles",
  "break_glass:review": "Review break-glass use",
  "patients:read": "See patients' details and consents",
  "patients:manage": "Correct patients' details and record their consents",
  "consents:manage": "Publish the tenant's consent documents",
  "patients:verify_identity": "Mark a patient's identity checked",
  "protocols:read": "See protocols and programs",
  "protocols:manage": "Draft protocols",
  "protocols:sign_off": "Sign off a protocol version",
  "programs:manage": "Set up and change programs",
  "intakes:read": "Read patients' intake answers",
  "tenant:manage": "Change the tenant's settings and companies",
  "brands:manage": "Set up brands and take them live",
  "catalogue:read": "See the products the tenant sells",
  "catalogue:manage": "Add products, change prices and block products",
  "audit:read": "Read and export the audit log",
};

/** The data zone a permission opens (ADR 0220), as a heading in the role editor. */
export const ZONE_LABELS: Record<DataZone, string> = {
  clinical: "Clinical records",
  operational: "Running the service",
  marketing: "Marketing",
  platform: "Staff and settings",
};
