# 0007. Three data zones: clinical, operational and marketing

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: Principle 2, CRM-01, ACQ-03, ACQ-04
- Regulation: Privacy Act 1988 (APP 6, APP 7); Therapeutic Goods Act advertising rules
- Sign-off: needed (data zones)

## Context

Telehealth marketing is where health data most often leaks: a pixel on a consult page, a CRM segment built on a diagnosis, an ad audience built from a prescription. The PRD makes keeping clinical data out of marketing a product rule, not a policy document.

## Decision

- **Four schemas:** `clinical` (intake answers, consult notes, scripts, care plans), `operational` (orders, payments, schedules, support), `marketing` (leads, campaigns, consent to marketing) and `platform` (tenants, sign-in links, memberships, audit, events, jobs).
- **Database roles follow the zones.** `medora_app` (the API) may use `platform`, `clinical` and `operational`. `medora_marketing` (marketing jobs and CRM sync) may use `marketing` and nothing in `clinical`. A test reads the catalogue and fails if `medora_marketing` gains any privilege on `clinical`.
- **Code follows the zones too.** Modules under `src/modules/marketing-*` may not import clinical modules (a dependency rule), and anything sent to an ad or CRM platform passes through one outbound mapper that only accepts marketing-zone fields.
- **Moving data from clinical to marketing** (for example, "started a program" for a care nudge) is a named, reviewed derived event with no clinical detail, recorded in the event catalogue.

## Consequences

- A marketing feature can't read a diagnosis by accident; it would need a migration granting access, which CODEOWNERS sends to review.
- Some reports need data from two zones and are built from derived events, not joins.

## Where it lives

- `src/db/migrations/` (schemas and grants), `.dependency-cruiser.cjs`, `test/integration/schema-rules.test.ts`.
