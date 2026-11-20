# 0002. Medora owns all of its code; no shared library to start

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Build strategy and external rails
- Regulation: none
- Sign-off: product owner, 20 Nov 2026

## Context

Medora starts from patterns and code that are already proven in production: a typed REST API with row-level checks, a staff console design system, a prescribing integration and a patient portal. That code can be brought in two ways: as a shared package that several products depend on, or copied in and owned here. A shared package couples Medora's release cycle, its tenancy model and its compliance rules to products that have none of them.

## Decision

- **Everything Medora runs is in `medora-backend` and `medora-front`.** Code brought in is copied, renamed to Medora's words, and made to follow Medora's ADRs (tenancy, data zones, audit) before it merges. It arrives with tests.
- **No runtime dependency on another product's packages, services or databases.**
- **A shared core may be pulled out later**, by its own ADR, once two products need the same change at the same time more than once.

## Consequences

- Medora can change any line without waiting on another team, and its compliance rules apply to every line.
- A bug fixed elsewhere is not fixed here automatically. Whoever copies code owns it from then on.
- Other products' names never appear in Medora's code or docs (see [0032](0032-one-word-per-thing-from-database-to-screen.md)).

## Where it lives

- Both repos. The names check: `scripts/check-names.mjs`.
