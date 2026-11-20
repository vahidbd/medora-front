# 0006. Every row carries a tenant id, enforced by the database

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: TEN-01, TEN-02, Multi-tenancy
- Regulation: Privacy Act 1988 (APP 11, security of personal information)
- Sign-off: needed (tenant isolation)

## Context

Medora serves many tenants (the clinics and operators that run their care on it) from one database. One missed `WHERE tenant_id = …` in application code would show one tenant's patients to another. Retrofitting a tenant column onto hundreds of tables later is a project of its own, so it has to be there from the first table.

## Decision

- **Every table holding tenant data has a `tenant_id uuid not null`** that references `platform.tenants`, and row-level security is enabled on it with one policy: `tenant_id = medora.current_tenant()`. `medora.current_tenant()` reads the transaction setting `app.tenant_id` and returns null when it is not set, so a query without a tenant sees nothing and can write nothing.
- **The API connects as `medora_api`, a login role in the group `medora_app` that owns nothing.** Row-level security applies to it. Tables are owned by the migration role, which only migrations and supervised scripts use. The API refuses to start if its database role is a superuser, can bypass row-level security, or owns any Medora table ([0025](0025-production-refuses-unsafe-settings.md)).
- **Tenant work runs in `withTenant(context, work)`** (`src/db/tenant.ts`): one transaction that sets `app.tenant_id` and `app.user_id` with `set_config(…, true)`, so the settings end with the transaction and can't leak to the next request on a pooled connection. Feature modules may not import the raw pool (a dependency rule in `.dependency-cruiser.cjs`).
- **The few things that must cross tenants** (finding which tenants a signed-in person belongs to, linking a sign-in to an invited account) are `SECURITY DEFINER` functions in the `platform` schema, each narrow, reviewed and tested.
- **Tables without a tenant are listed** with a reason in `test/integration/schema-rules.test.ts`. That test reads the database catalogue and fails when a table has neither a tenant id with a policy nor a listed reason.
- **Isolation is tested on every pull request**: a tenant never reads, changes or deletes another tenant's rows, and a query without a tenant sees nothing.

## Consequences

- Isolation holds even when application code forgets a filter.
- Every new table needs its tenant id and policy in its migration, or CI fails.
- Background work that spans tenants (event delivery, nightly checks) runs one tenant at a time through `withTenant`, or through a reviewed `SECURITY DEFINER` function.

## Where it lives

- `src/db/tenant.ts`, `src/db/migrations/`, `test/integration/tenancy.test.ts`, `test/integration/schema-rules.test.ts`.
