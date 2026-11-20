# 0033. What must be true before the first patient

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Phased roadmap (first-patient gate), Recovery, Access, Vendors, Privacy, Security assurance
- Regulation: Privacy Act 1988 (NDB scheme); ADHA conformance for electronic prescribing
- Sign-off: needed (launch)

## Context

Several things can only be proven outside the code, and each is easy to leave "for later" once the product works: restoring a backup, an outside security test, a privacy assessment, email that reaches inboxes, an access review. Each one left undone is a real risk on the day a patient's data arrives.

## Decision

The first patient is treated only when all of these are done and recorded in `docs/launch-checklist.md` with the date and evidence:

1. **The PRD's three gates**: an external penetration test with its high findings fixed, a privacy impact assessment, and a live Parchment connection.
2. **A backup restored** into a fresh database and checked, with the time it took written down; then every six months ([0005](0005-patient-data-stays-in-australia.md), PRD Recovery: RPO 15 minutes, RTO 4 hours).
3. **A load test** at the volumes the first tenant expects, plus a spike.
4. **A Clerk production instance**, with staff sign-up closed and second factors required by role.
5. **Email and SMS deliverability per brand**: SPF, DKIM and DMARC on each sending domain, bounce handling, and registered SMS sender ids.
6. **Two-factor sign-in and an access review** on every console that can reach production ([0025](0025-production-refuses-unsafe-settings.md)).
7. **Each AI agent** has passed its eval set, has a spending cap and starts switched off for the tenant ([0012](0012-ai-agents-act-through-the-api-as-a-role.md)).
8. **A breach response plan** under the Notifiable Data Breaches scheme, and a named person to run it.
9. **Every provider in `docs/providers.md`** has a data processing agreement and a security review.

## Consequences

- Launch can slip for work that isn't code. That is the intent.
- The checklist is the place a second tenant's launch starts from too.

## Where it lives

- `docs/launch-checklist.md`.
