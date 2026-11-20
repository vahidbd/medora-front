# 0008. Every read and write of clinical data goes to an append-only audit log

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: Principle 3, ADM-05, Audit
- Regulation: state health records laws; Privacy Act 1988 (APP 11)
- Sign-off: needed (patient data)

## Context

When a patient asks who saw their record, or a regulator asks who changed a script, the answer must come from a log nobody could have edited, kept at least seven years (longer for minors once they are supported).

## Decision

- **`platform.audit_log`** records who acted (a person, an AI agent or the system, by id), what they did, on which record (table and id), in which tenant and zone, the request id and when. Details hold ids and facts only, never names, contact details or clinical text.
- **Written in the same transaction as the change** (`audit(tx, …)` in `src/lib/audit.ts`), so a change and its audit row commit together or not at all. Reads of clinical records are audited the same way.
- **Append-only, enforced by the database.** No role is granted UPDATE or DELETE on it, and a trigger refuses UPDATE, DELETE and TRUNCATE for every role, the owner included.
- **Kept seven years at least**; moving old rows to cheaper storage is a later ADR, and never deletes them.
- **Every route that changes data declares its audit action**, or a reason it has none; a test fails when one does neither.

## Consequences

- The audit log grows with every clinical read. It is partitioned by month when volume needs it.
- A correction is a new row, never an edit.

## Where it lives

- `src/lib/audit.ts`, the `platform.audit_log` table and its trigger in `src/db/migrations/`, `test/integration/audit.test.ts`.
- `src/plugins/route-rules.ts`: a route that changes data must name its audit actions before the app starts.
