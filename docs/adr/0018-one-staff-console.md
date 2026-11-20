# 0018. One staff console for every team, one patient app, and the brand sites

- Status: Proposed
- Date: 20 Nov 2026
- Repos: frontend
- PRD: Overview, Principle 4
- Regulation: none
- Sign-off: product owner

## Context

Clinicians, support, operations and finance all work on the same patients and orders. Separate apps per team tend to copy their shell, sign-in and data code from each other and then drift, and staff with two jobs need two logins.

## Decision

- **One staff console** at its own address for every team, under one sign-in. What each person sees comes from their role and permissions, not from which app they opened.
- **One patient app**, separate from the staff console, branded per tenant.
- **Brand sites** for each tenant's brands, with no access to clinical data and no tracking scripts on any page that shows health data.
- All three share the design system ([0003](0003-one-design-system-the-grid-ui-kit.md)) and the API contract ([0014](0014-one-contract-package.md)).

## Consequences

- Shell, navigation and data code exist once.
- The console's menu grows with every module, so its structure is decided in `DESIGN.md` before modules arrive.

## Where it lives

- Frontend `src/app/(console)/`, `src/app/(patient)/`, `src/app/(sites)/` as they are built.
