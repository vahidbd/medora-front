# 0029. Background jobs run once, and outside calls happen after the database commits

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: Multi-tenancy (per-tenant queues), Availability
- Regulation: none
- Sign-off: needed (money)

## Context

A scheduled job that overlaps itself, is retried, or is caught up after a restart can send a patient two reminders or charge them twice. A charge sent to a processor inside a database transaction that then rolls back leaves money taken with no record of it. Heavy work in the API process (rendering PDFs, processing media) competes with every request. State kept in the API's memory (a cache, a counter) behaves differently as soon as there are two copies of the API.

## Decision

- **One run of a job at a time across processes**, through a lease row (`withLease` in `src/lib/leases.ts`). A second run is skipped and logged. A lease runs out on its own if its holder dies.
- **Catching up a missed run** happens only for jobs listed as safe to run late (they send nothing to patients and move no money).
- **Every call that sends something or moves money** (payments, refunds, emails, texts, calls, Parchment) carries an idempotency key and is made after the database commits, from the outbox ([0016](0016-money-ledger-and-events.md)), never inside a transaction.
- **Incoming webhooks are verified, stored, then processed** once per provider event id.
- **Heavy work runs in worker services**, not the API.
- **The API keeps no state in memory that changes behaviour.** Caches are short-lived and safe to miss, or live in Postgres. Staging runs two copies of the API to prove it.
- **Queues are per tenant** where volume can differ, so one tenant's spike can't stall the others.

## Consequences

- Retries and restarts can't double-send or double-charge.
- A message or charge goes out a moment after the change commits rather than during it.

## Where it lives

- `src/lib/events.ts` and `platform.outbox` now.
- `src/lib/leases.ts` and `platform.job_leases` arrive with the first worker.
