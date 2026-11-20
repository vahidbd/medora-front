# 0034. The core before breadth; each feature ships whole

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Phased roadmap
- Regulation: none
- Sign-off: product owner

## Context

With AI agents building in parallel, it is easy to build many features quickly and leave the core (tenancy, audit, money, compliance gates, tests) to be hardened later. Later then means a review that finds the foundations missing under a large amount of feature code, and a long pause to fix them.

## Decision

- **A module starts when its PRD phase does**, and a phase starts only when the gate before it has passed. Work outside the current phase needs the product owner's go-ahead.
- **Each feature ships whole in one pull request**: code, migrations with tenant ids and policies, response schemas, audit actions, events, agent tools (or the reason there are none), rulings in `docs/decisions/`, tests including Playwright for risky flows, preview fixtures, and an ADR when it makes a system-level choice.
- **Pull requests stay reviewable**: one feature or one fix each. A pull request that grows past about 1,500 changed lines (generated files excluded) is split.
- **When a review finds a gap in the core, new features wait** until it is fixed.

## Consequences

- Features arrive a little slower, and the platform never has to stop for a clean-up.

## Where it lives

- The pull request template's checklist, `AGENTS.md` ("Hit every surface").
