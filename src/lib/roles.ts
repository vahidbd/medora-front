import type { MembershipStatus, Permission, Role } from "@/lib/api/types";

/** How each role reads on a screen. The API's values stay as they are; the words come from here alone. */
export const ROLE_LABELS: Record<Role, string> = {
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
  custom: "Custom role",
};

/** How each membership status reads, and its tone. */
export const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: "success" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Paused", tone: "neutral" },
  invited: { label: "Invited", tone: "neutral" },
};

/** What each permission lets a staff member do, in words. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "staff:read": "See the tenant's staff",
  "staff:manage": "Change staff roles and access",
  "roles:manage": "Create and change the tenant's own roles",
  "break_glass:review": "Review emergency access to clinical records",
  "patients:read": "See patients' identity and contact details",
  "patients:manage": "Correct patients' details and record their consent",
  "consents:manage": "Publish the tenant's consent documents",
};
