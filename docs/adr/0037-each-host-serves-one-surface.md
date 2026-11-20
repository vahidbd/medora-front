# 0037. Each host serves one surface: the console on its own hosts, a brand's patient app on the brand's

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: APP-01, APP-02, ADM-01
- Regulation: Privacy Act 1988 (APP 6, APP 11)
- Sign-off: needed (sign-in, patient data, security headers)

## Context

One web deployment serves the staff console and every brand's patient app ([0018](0018-one-staff-console.md), [0022](0022-web-patient-app-first.md), [0023](0023-conditions-are-configuration.md)). Their paths collide (`/home`, `/sign-in`), and they must not mix: a patient page signs in on the patient instance ([0035](0035-patients-sign-in-on-their-own-instance.md)), carries no browser error tracking ([0026](0026-observability-from-the-first-deploy.md)) and must not be kept by anything in between, while a console page must never answer on a brand's domain. Each brand has its own domains, held as brand data. The platform's edge routes by the Host header, which a caller can't change once it arrives; forwarded host headers are the caller's to write.

## Decision

- **The Host header picks the surface**, in `src/proxy.ts`, never a forwarded header. Hosts listed in `CONSOLE_HOSTS` get the console. Any other host must be a live or paused brand's verified patient host, asked of the API's public route `GET /v1/public/brands/by-host/:host`; a host that isn't answers 404, and a lookup that fails answers 503, never the console.
- **On a brand's host every page is the patient app**: its paths are rewritten into `src/app/(patient)/patient/`. Those files are never served at their own address, on any host, and no console path exists on a brand's host.
- **The brand travels in request headers only the proxy writes** (`x-medora-brand-host`, `x-medora-brand`); the proxy drops any copy a caller sends.
- **The relay is scoped by surface.** On a brand's host it reaches only the API's `/v1/patient/*`, sends the brand's host and the brand's tenant, found by this server from the host and never taken from the browser, and marks every reply `no-store`. On the console it never reaches `/v1/patient/*`.
- **Patient pages keep nothing**: `Cache-Control: no-store`, no service worker, nothing in browser storage but the theme, and the data cache emptied on sign-out and idle sign-out. Their security policy has no error tracker's origin.
- **A brand's look is configuration**: one colour, used for the primary only when its text reaches 4.5:1 on it, else the kit's own.
- **Staging and production refuse to start** without `CONSOLE_HOSTS`, the patient instance's keys (never the staff instance's) and `CLERK_ENCRYPTION_KEY` ([0025](0025-production-refuses-unsafe-settings.md)).

## Consequences

- One deployment, one set of components and one security policy builder serve every brand. A new brand domain is data plus a DNS record and a platform custom domain, with no deploy.
- Every patient request needs the brand. Lookups are kept a minute per host in each server process, so a brand that is paused or loses a domain can keep answering for up to a minute.
- Tests and preview need hosts: `*.localhost` names, which resolve to the machine itself.
- Brand sites ([0018](0018-one-staff-console.md)) are a different surface: they carry marketing and never a clinical page, and are not served here.

## Where it lives

- Frontend: `src/proxy.ts`, `src/lib/surface.ts`, `src/lib/brand.ts`, `src/lib/server/brand.ts`, `src/lib/server/relay.ts`, `src/lib/server/deployed-settings.ts`, `src/app/(patient)/patient/`, `test/unit/patient-surface.test.ts`, `test/unit/relay.test.ts`, `test/unit/brand-lookup.test.ts`, `test/e2e/patient.spec.ts`. Rulings: `docs/decisions/patient-app.md`.
- Backend: `GET /v1/public/brands/by-host/:host` and `platform.brand_domains` (to come, with the brands work).
