# 0024. A deploy fails loudly and proves what is live

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Availability
- Regulation: none
- Sign-off: product owner

## Context

A deploy job that skips itself when a secret is missing, and still reports success, can leave production weeks behind `main` while every run looks green. A hosting trial that ends, a provider that loses access to the repository, or a CI spending limit can each stop deploys or remove a service without a single red mark anywhere. The failure is found only when someone notices the site has been down.

## Decision

- **A deploy step never skips itself.** A missing secret, an unreachable host or a missing service fails the run, red, with what is missing.
- **Deploys are switched on deliberately**, once staging exists, with the repository variable `DEPLOYS=on`. Until then the deploy workflow does not start, and the README says deploys are off. Once it is on, nothing in the workflow can quietly opt out: a missing secret fails it.
- **Every release says which commit it is.** CI writes the commit into the build, and `GET /health` answers with it as `version`. After each deploy, `scripts/release.mjs verify` waits until `/health` answers with the deployed commit, then watches `/health` and `/health/ready` for a minute. If the new release falls over, it rolls back to the release before and fails the run. If it can't tell, that is a failure too.
- **A nightly check compares** the commit live on staging and production with `main` and with the last promotion, and alerts when staging is more than a day behind `main`.
- **Hosting, the database and every provider are on paid plans** with billing alerts sent to a person, so a trial ending or a card expiring can't take Medora down quietly.
- **Uptime checks** watch the API's `/health/ready` and the web app's `/api/health` every minute and page a person ([0026](0026-observability-from-the-first-deploy.md)).

## Consequences

- A deploy problem shows up as a red run within minutes, not as an outage found later.
- Turning deploys on is a conscious step taken when the staging environment exists.

## Where it lives

- `.github/workflows/deploy.yml`, `scripts/release.mjs`, `GET /health` in `src/app.ts`, the frontend's `src/app/api/health/route.ts`.
