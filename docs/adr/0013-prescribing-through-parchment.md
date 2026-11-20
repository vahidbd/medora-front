# 0013. Prescribing through Parchment; Medora does not dispense

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: RX-01, PHA-01 to PHA-07
- Regulation: Electronic prescribing conformance (ADHA); Poisons Standard; state poisons acts
- Sign-off: product owner, 20 Nov 2026

## Context

Writing electronic scripts needs a conformant prescribing system, prescriber identity checks and links to the national prescription exchange. Building that in-house takes months of conformance work. Dispensing needs a pharmacy licence that Medora does not hold.

## Decision

- **Prescribers write scripts in Parchment.** From a patient's record, the prescriber opens the patient in Parchment in a new tab; Medora creates or updates the patient there first. Scripts come back to Medora by Parchment's webhook and are matched to the patient.
- **The consult gate comes first** ([0009](0009-compliance-gates-in-the-backend.md)): Medora opens Parchment for a patient only after a recorded real-time consult, and flags any script that arrives without one.
- **Webhooks are verified, stored before they are processed, and processed idempotently** ([0029](0029-jobs-run-once-and-outside-calls-after-commit.md)).
- **Medora builds no pharmacy app and does not dispense.** The tenant's pharmacy dispenses; a small partner page lets it mark orders dispensed and shipped ([0021](0021-two-billing-models.md)).
- **Fully in-house prescribing comes later**, by a new ADR.

## Consequences

- Launch does not wait on prescribing conformance.
- Medora can't stop a script being written inside Parchment directly; it can only refuse to open Parchment without a consult and flag what comes back without one.

## Where it lives

- The prescribing module and its Parchment adapter when they are built.
