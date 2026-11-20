import { request } from "./client";
import type {
  BreakGlassRecord,
  CustomRole,
  InvitationInput,
  InvitationReply,
  Me,
  MembershipChange,
  RoleInput,
  RolesReply,
  RoleUpdate,
  SignIn,
  StaffList,
  StaffMember,
} from "./types";

const id = (value: string) => encodeURIComponent(value);

export const meApi = {
  /** Who the API says the session belongs to, and their tenants. Needs no tenant. */
  get: () => request<Me>("/me"),
  signIns: async () => (await request<{ signIns: SignIn[] }>("/me/sign-ins")).signIns,
};

export const staffApi = {
  list: async (tenant: string) => (await request<StaffList>("/staff", { tenant })).staff,
  change: (tenant: string, membershipId: string, change: MembershipChange) =>
    request<StaffMember>(`/staff/${id(membershipId)}`, { method: "PATCH", body: change, tenant }),
  invite: (tenant: string, input: InvitationInput) =>
    request<InvitationReply>("/staff/invitations", { method: "POST", body: input, tenant }),
  resend: (tenant: string, membershipId: string) =>
    request<InvitationReply>(`/staff/${id(membershipId)}/invitation`, { method: "POST", tenant }),
  withdraw: (tenant: string, membershipId: string) =>
    request<{ membershipId: string }>(`/staff/${id(membershipId)}/invitation`, { method: "DELETE", tenant }),
  signIns: async (tenant: string, membershipId: string) =>
    (await request<{ signIns: SignIn[] }>(`/staff/${id(membershipId)}/sign-ins`, { tenant })).signIns,
};

export const rolesApi = {
  list: (tenant: string) => request<RolesReply>("/roles", { tenant }),
  create: (tenant: string, input: RoleInput) => request<CustomRole>("/roles", { method: "POST", body: input, tenant }),
  update: (tenant: string, roleId: string, change: RoleUpdate) =>
    request<CustomRole>(`/roles/${id(roleId)}`, { method: "PATCH", body: change, tenant }),
  remove: (tenant: string, roleId: string) => request<{ roleId: string }>(`/roles/${id(roleId)}`, { method: "DELETE", tenant }),
};

export const breakGlassApi = {
  open: (tenant: string, reason: string) => request<BreakGlassRecord>("/break-glass", { method: "POST", body: { reason }, tenant }),
  /** Ends every break-glass of yours still running in the tenant. */
  close: (tenant: string) => request<{ breakGlass: BreakGlassRecord[] }>("/break-glass/close", { method: "POST", tenant }),
  list: async (tenant: string, unreviewed: boolean) =>
    (await request<{ breakGlass: BreakGlassRecord[] }>(`/break-glass?unreviewed=${unreviewed}`, { tenant })).breakGlass,
  review: (tenant: string, breakGlassId: string, note: string) =>
    request<BreakGlassRecord>(`/break-glass/${id(breakGlassId)}/review`, { method: "POST", body: { note }, tenant }),
};
