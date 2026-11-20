# 0009. Compliance gates live in the backend and the database, and tenants can't switch them off

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend (the frontend only explains them)
- PRD: RX-02, CON-03, BIL-04, PHA-06
- Regulation: Medical Board of Australia telehealth guidelines; Poisons Standard; Therapeutic Goods Act
- Sign-off: needed (clinical safety)

## Context

Telehealth prescribing has rules a business could be tempted to bend: a script needs a real-time consult with a prescriber, medicine can't be charged for before it is prescribed, and some products can't be promoted or supplied this way at all. If those rules live in screens, a new screen, an API call or an AI agent can step around them.

## Decision

- **No script without a recorded real-time consult.** A video or phone consult (chat does not count) with the prescribing practitioner is recorded before the prescriber can open the prescribing system for that patient, and any script that arrives without one is flagged to the tenant's medical director.
- **No medicine charged without a current script**, enforced where payments are created.
- **Products a tenant may not supply** are blocked in the catalogue and at checkout.
- **Enforced in the backend, and in the database where it can be**, with tests. Tenant settings can make a gate stricter, never weaker. No route, agent tool or test helper skips one.

## Consequences

- Every path to a script, a charge or an order passes the same checks, including AI agents acting through the API.
- A tenant that asks for an exception gets a "no" from the platform, not a setting.

## Where it lives

- The prescribing, consult and billing modules when they are built; their rulings in `docs/decisions/`.
