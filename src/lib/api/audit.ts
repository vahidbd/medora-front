import { request } from "./client";
import type { AuditExport, AuditFilter, AuditPage } from "./types";

/** The tenant's audit log: a page at a time, newest first, or every match as an export (docs/decisions/admin.md ADM25, ADM26). */
export const auditApi = {
  page: (tenant: string, filter: AuditFilter, before: string | null) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filter)) if (value) query.set(key, value);
    if (before) query.set("before", before);
    const search = query.toString();
    return request<AuditPage>(`/audit${search ? `?${search}` : ""}`, { tenant });
  },
  export: (tenant: string, filter: AuditFilter) => request<AuditExport>("/audit/exports", { method: "POST", body: filter, tenant }),
};
