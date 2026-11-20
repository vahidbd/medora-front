# 0031. Quality gates: tests that prove the risky flows, patched dependencies, strict builds

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Security assurance, Accessibility
- Regulation: WCAG 2.2 AA
- Sign-off: product owner

## Context

Checking screens by eye is not testing. Libraries with published vulnerabilities stay in place when nothing updates them. A build that skips its type check, or a linter that arrives late with hundreds of suppressed problems, lets broken code ship. A screen that shows "nothing here" when the data failed to load tells a clinician a patient has no allergies.

## Decision

- **Tests must assert**: a test whose expectations never ran fails (Vitest `requireAssertions`).
- **End-to-end tests with Playwright** cover every flow that touches a script, money or patient data, from the first such feature, in CI against preview mode and, once they exist, against staging.
- **Concurrency tests** for anything that moves money or counts limits: the same posting twice at once, both must land correctly.
- **A failing test before every bug fix**, at the lowest layer that shows the bug. No sleeps or retries in tests.
- **Dependencies stay patched**: Dependabot in both repos (weekly npm, grouped minor and patch; monthly GitHub Actions and Docker), and CI fails on a high or critical advisory in production dependencies (`npm audit --omit=dev --audit-level=high`).
- **Strict builds**: TypeScript strict mode, the type check is a required CI job, and the frontend build never ignores type errors.
- **Lint with no baseline**: every rule is on from the first commit, with no suppressions file.
- **"Did not load" never looks like "empty"**: a failed read shows that it failed and offers a retry; an editor never saves over data it failed to read.
- **Patient screens are checked for accessibility** (axe in the Playwright suite).

## Consequences

- CI takes longer than a lint-only pipeline. Its jobs run in parallel to keep it under ten minutes.
- An agent can't merge a feature without proving its risky paths.

## Where it lives

- `vitest.config.ts`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `eslint.config.js`; frontend `playwright.config.ts`, `e2e/`.
