# 0023. Conditions are configuration, not code

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: INT-01 to INT-04, TEN-04
- Regulation: Medical Board of Australia telehealth guidelines (protocols signed off by a medical director)
- Sign-off: product owner, 20 Nov 2026

## Context

The first tenant runs a weight loss service, but the platform must serve any telehealth service. Building weight loss into the code would make every later condition a rewrite.

## Decision

- **Protocols, intake questions, eligibility rules, products and programs are tenant data**, edited in the console and versioned. A tenant's medical director signs off each protocol version before it goes live.
- **The platform ships templates** that tenants copy and adapt. Weight loss is the first template.
- **No condition name, product name or dose appears in code.** Tests use made-up conditions.

## Consequences

- A new service is configuration and a medical director's sign-off, not a release.
- The intake and protocol engine must be general from the start, which takes longer than hard-coding one condition.

## Where it lives

- The intake and protocol modules when they are built.
