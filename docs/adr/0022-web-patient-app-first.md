# 0022. The patient app is a web app first

- Status: Accepted
- Date: 20 Nov 2026
- Repos: frontend
- PRD: APP-01
- Regulation: WCAG 2.2 AA
- Sign-off: product owner, 20 Nov 2026

## Context

Patients need to sign in, complete intake, book and join consults, pay, track orders and message their care team. Native apps add store reviews and two more codebases before the first patient.

## Decision

- **A responsive web app first**, in the same design system as the staff console and branded per tenant.
- **Native iOS and Android apps come later** from the same code, by a new ADR.
- **No tracking scripts, no patient data in URLs or browser storage**, and no third-party scripts on pages that show health data.

## Consequences

- One codebase for patients at launch; push notifications wait for native apps or web push.

## Where it lives

- Frontend `src/app/(patient)/` when it is built.
