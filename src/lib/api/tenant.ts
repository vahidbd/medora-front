import { request } from "./client";
import type {
  Brand,
  BrandChange,
  BrandInput,
  BrandStatus,
  Company,
  CompanyChange,
  CompanyInput,
  Onboarding,
  OwnerInvitationReply,
  PlatformDomain,
  PlatformTenant,
  TenantCreated,
  TenantInput,
  TenantSettings,
  TenantSettingsChange,
} from "./types";

const id = (value: string) => encodeURIComponent(value);

/** The tenant's own settings and onboarding checklist (docs/decisions/admin.md ADM18, ADM20). */
export const tenantApi = {
  get: (tenant: string) => request<TenantSettings>("/tenant", { tenant }),
  change: (tenant: string, change: TenantSettingsChange) =>
    request<TenantSettings>("/tenant", {
      method: "PATCH",
      body: change,
      tenant,
    }),
  onboarding: (tenant: string) => request<Onboarding>("/tenant/onboarding", { tenant }),
};

/** Companies and their ABNs (ADM19). */
export const companiesApi = {
  list: async (tenant: string) => (await request<{ companies: Company[] }>("/companies", { tenant })).companies,
  create: (tenant: string, input: CompanyInput) => request<Company>("/companies", { method: "POST", body: input, tenant }),
  change: (tenant: string, companyId: string, change: CompanyChange) =>
    request<Company>(`/companies/${id(companyId)}`, {
      method: "PATCH",
      body: change,
      tenant,
    }),
  remove: (tenant: string, companyId: string) =>
    request<{ companyId: string }>(`/companies/${id(companyId)}`, {
      method: "DELETE",
      tenant,
    }),
};

/** Brands and their domains (ADM15 to ADM17). */
export const brandsApi = {
  list: async (tenant: string) => (await request<{ brands: Brand[] }>("/brands", { tenant })).brands,
  create: (tenant: string, input: BrandInput) => request<Brand>("/brands", { method: "POST", body: input, tenant }),
  change: (tenant: string, brandId: string, change: BrandChange) =>
    request<Brand>(`/brands/${id(brandId)}`, {
      method: "PATCH",
      body: change,
      tenant,
    }),
  setStatus: (tenant: string, brandId: string, status: Exclude<BrandStatus, "draft">) =>
    request<Brand>(`/brands/${id(brandId)}/status`, {
      method: "POST",
      body: { status },
      tenant,
    }),
  addDomain: (tenant: string, brandId: string, host: string) =>
    request<Brand>(`/brands/${id(brandId)}/domains`, {
      method: "POST",
      body: { host },
      tenant,
    }),
  removeDomain: (tenant: string, brandId: string, domainId: string) =>
    request<{ domainId: string }>(`/brands/${id(brandId)}/domains/${id(domainId)}`, { method: "DELETE", tenant }),
};

/** Platform staff's work across tenants: no tenant header (ADM14, ADM15). */
export const platformApi = {
  tenants: async () => (await request<{ tenants: PlatformTenant[] }>("/platform/tenants")).tenants,
  createTenant: (input: TenantInput) =>
    request<TenantCreated>("/platform/tenants", {
      method: "POST",
      body: input,
    }),
  resendOwnerInvitation: (tenantId: string) =>
    request<OwnerInvitationReply>(`/platform/tenants/${id(tenantId)}/owner-invitation`, { method: "POST" }),
  domains: async (waiting: boolean) => (await request<{ domains: PlatformDomain[] }>(`/platform/domains?waiting=${waiting}`)).domains,
  verify: (domainId: string) => request<{ domainId: string; host: string }>(`/platform/domains/${id(domainId)}/verify`, { method: "POST" }),
};
