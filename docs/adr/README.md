# Architecture decision records

How Medora as a whole gets its shape: the stack, hosting, tenancy, data zones, security, money, AI autonomy and delivery. Why one feature works the way it does is in `docs/decisions/` instead.

The same files sit in `medora-backend` and `medora-front`, word for word. CI fails when they differ (`scripts/check-adr-sync.mjs`).

## Rules

- **When:** a pull request that adds a service or outside provider, or changes how money, sign-in, permissions, tenancy, data zones, audit, deploys or AI autonomy work, or sets a rule every module must follow, adds an ADR (or supersedes one) in both repos.
- **Same pull request as the change.** Never written afterwards.
- **Number** after the newest ADR on the pull request's base branch, four digits. File name: `NNNN-kebab-case-title.md`.
- **Statuses:** Proposed, Accepted, Deferred, Rejected, Superseded by NNNN. An accepted ADR is never rewritten; a new one replaces it and the old one's status says so.
- **Who accepts:** anyone may propose. An ADR touching clinical safety gates, data zones, tenant isolation, patient data, money or AI autonomy becomes Accepted only when the product owner approves the pull request that carries it.
- **Words:** the ones in `GLOSSARY.md`. No people's names, secrets, patient or tenant details, or other products' names.

## Template

```markdown
# NNNN. Title as a decision, in sentence case

- Status: Proposed
- Date: D Mon YYYY
- Repos: backend | frontend | backend and frontend
- PRD: requirement ids, or none
- Regulation: the law or standard behind it, or none
- Sign-off: needed (what kind) | product owner, D Mon YYYY

## Context

What forces the decision. Facts, not the answer.

## Decision

What we do, as rules someone can check.

## Consequences

What gets easier, what gets harder, what is now owed.

## Where it lives

Files, tables, checks.
```

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions from the first commit | Accepted |
| [0002](0002-medora-owns-all-of-its-code.md) | Medora owns all of its code; no shared library to start | Accepted |
| [0003](0003-one-design-system-the-grid-ui-kit.md) | One design system: the Grid UI kit | Proposed |
| [0004](0004-stack-typescript-nextjs-fastify-postgres.md) | Stack: TypeScript, Next.js, Fastify, Zod, Drizzle and Postgres | Accepted |
| [0005](0005-patient-data-stays-in-australia.md) | Patient data, backups and AI models stay in Australia | Accepted |
| [0006](0006-tenant-isolation-in-the-database.md) | Every row carries a tenant id, enforced by the database | Proposed |
| [0007](0007-three-data-zones.md) | Three data zones: clinical, operational and marketing | Proposed |
| [0008](0008-append-only-audit-log.md) | Every read and write of clinical data goes to an append-only audit log | Proposed |
| [0009](0009-compliance-gates-in-the-backend.md) | Compliance gates live in the backend and the database, and tenants can't switch them off | Proposed |
| [0010](0010-field-encryption-per-tenant.md) | Intake answers and notes are encrypted per field, with each tenant's own keys | Proposed |
| [0011](0011-clerk-signs-in-staff-and-patients.md) | Clerk signs in staff and patients | Accepted |
| [0012](0012-ai-agents-act-through-the-api-as-a-role.md) | AI agents act through the API as a role, start switched off, and treat outside text as data | Proposed |
| [0013](0013-prescribing-through-parchment.md) | Prescribing through Parchment; Medora does not dispense | Accepted |
| [0014](0014-one-contract-package.md) | One contract: every route declares its schemas, and the frontend's types are generated from them | Proposed |
| [0015](0015-delivery-staging-review-and-checked-migrations.md) | Delivery: staging first, a person reviews sensitive changes, migrations are checked | Proposed |
| [0016](0016-money-ledger-and-events.md) | Money in exact cents on an append-only ledger; events in the same transaction | Proposed |
| [0017](0017-time-zones-per-tenant-and-patient.md) | Times are stored in UTC and shown in the tenant's or patient's time zone | Proposed |
| [0018](0018-one-staff-console.md) | One staff console for every team, one patient app, and the brand sites | Proposed |
| [0019](0019-stripe-and-eway-behind-one-interface.md) | Stripe and eWAY behind one payments interface | Accepted |
| [0020](0020-phone-video-and-ai-voice-consults.md) | Real-time consults by phone and video from launch, plus AI voice calls | Accepted |
| [0021](0021-two-billing-models.md) | Two billing models, chosen per tenant or program | Accepted |
| [0022](0022-web-patient-app-first.md) | The patient app is a web app first | Accepted |
| [0023](0023-conditions-are-configuration.md) | Conditions are configuration, not code | Accepted |
| [0024](0024-deploys-fail-loudly-and-prove-what-is-live.md) | A deploy fails loudly and proves what is live | Proposed |
| [0025](0025-production-refuses-unsafe-settings.md) | Production refuses unsafe settings at boot, and production keys stay in production | Proposed |
| [0026](0026-observability-from-the-first-deploy.md) | Observability from the first deploy | Proposed |
| [0027](0027-modules-have-a-front-door.md) | Backend modules have a front door from the first module, and one engine per job | Proposed |
| [0028](0028-the-database-checks-its-own-rules.md) | The database checks its own rules | Proposed |
| [0029](0029-jobs-run-once-and-outside-calls-after-commit.md) | Background jobs run once, and outside calls happen after the database commits | Proposed |
| [0030](0030-security-baseline-from-the-first-route.md) | Security baseline from the first route | Proposed |
| [0031](0031-quality-gates.md) | Quality gates: tests that prove the risky flows, patched dependencies, strict builds | Proposed |
| [0032](0032-one-word-per-thing-from-database-to-screen.md) | One word per thing, from the database to the screen | Proposed |
| [0033](0033-before-the-first-patient.md) | What must be true before the first patient | Proposed |
| [0034](0034-the-core-before-breadth.md) | The core before breadth; each feature ships whole | Proposed |
| [0035](0035-patients-sign-in-on-their-own-instance.md) | Patients sign in on their own sign-in instance, and hold one record per tenant | Proposed |
| [0037](0037-each-host-serves-one-surface.md) | Each host serves one surface: the console on its own hosts, a brand's patient app on the brand's | Proposed |

## Timeline

- **20 Nov 2026**: 0001 to 0034, the founding set, written with the first commit of each repo. 0001, 0002, 0004, 0005, 0011, 0013 and 0019 to 0023 were settled by the product owner's answers that day; the rest are Proposed until the foundation pull requests are approved.
- **20 Nov 2026**: 0035, patient sign-in, with the intake and identity work.
- **20 Nov 2026**: 0037, the console and the patient app told apart by host, with the patient app.
