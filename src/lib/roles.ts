import type { MembershipStatus, Permission, Role } from "@/lib/api/types";

/** How each role reads on a screen. The API's values stay as they are; the words come from here alone. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  clinician: "Clinician",
  support: "Support",
  finance: "Finance",
};

/** How each membership status reads, and its tone. */
export const MEMBERSHIP_STATUS: Record<MembershipStatus, { label: string; tone: "success" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Paused", tone: "neutral" },
};

/** What each permission lets a staff member do, in words. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "staff:read": "See the tenant's staff",
  "staff:manage": "Change staff roles and access",
  "ledger:read": "See the ledger and its balances",
  "payment_accounts:manage": "Connect and manage payment accounts",
  "prices:manage": "Set and publish prices",
  "subscriptions:read": "See subscriptions",
  "subscriptions:manage": "Pause, skip, cancel and reinstate subscriptions",
  "invoices:read": "See invoices",
};
