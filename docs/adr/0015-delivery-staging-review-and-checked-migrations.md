# 0015. Delivery: staging first, a person reviews sensitive changes, migrations are checked

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Security assurance
- Regulation: none
- Sign-off: product owner (reviews confirmed 20 Nov 2026)

## Context

Medora is built by AI agents in parallel, one pull request each. Shipping each merge straight to production with no second environment and no human review is fast, but two green pull requests can break `main` together, a bad migration reaches patients, and nobody has looked at a change to money or permissions before it is live. Holding fixes on a long-lived branch instead makes that branch drift from `main` until merging it is a project.

## Decision

- **Two environments: staging, then production.** A push to `main` deploys to staging after CI on `main` has passed. Production deploys only by promoting a commit that is live and healthy on staging, through the GitHub `production` environment, which needs a person's approval.
- **`main` is protected**: pull requests only, required checks, no force pushes, and a merge queue so a change is tested against everything merged before it.
- **A person reviews** any change to clinical rules, money, permissions, tenancy, data zones, AI autonomy or migrations before it merges. `.github/CODEOWNERS` lists those paths and branch protection requires the owner's review.
- **No long-lived branches.** Unfinished work merges behind a feature flag that is off in production.
- **The migration check** (`scripts/check-migrations.mjs`) runs on every pull request and before every deploy. It refuses a migration that is edited, renamed or removed after merging, one whose journal entry is not after the newest on `main` (it would be skipped silently), one dated in the future, and SQL that drops, renames, retypes, truncates or deletes. A schema change that removes something goes in two steps (expand, then contract in a later release), and the contract step says why with `-- migration-guard: allow <reason>`.
- **Migrations run before the new release takes traffic**, under an advisory lock, so a failed migration keeps the previous release serving.

## Consequences

- A merge reaches production minutes to hours later, after staging has run it, not a minute later.
- The product owner's review is on the critical path for sensitive changes; agents batch them where they can.

## Where it lives

- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/CODEOWNERS`, `scripts/check-migrations.mjs`, `src/db/migrate.ts`.
