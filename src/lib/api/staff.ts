import { request } from "./client";
import type { Me, MembershipChange, StaffMember } from "./types";

export const meApi = {
  /** Who the API says the session belongs to, and their tenants. Needs no tenant. */
  get: () => request<Me>("/me"),
};

export const staffApi = {
  list: async (tenant: string) => (await request<{ staff: StaffMember[] }>("/staff", { tenant })).staff,
  change: (tenant: string, membershipId: string, change: MembershipChange) =>
    request<StaffMember>(`/staff/${encodeURIComponent(membershipId)}`, { method: "PATCH", body: change, tenant }),
};
