# 0025. Production refuses unsafe settings at boot, and production keys stay in production

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Hosting, Access
- Regulation: Privacy Act 1988 (APP 11)
- Sign-off: needed (patient data)

## Context

Settings that are only exercised now and then fail long after the deploy that broke them: files written to a container disk that every deploy wipes, sign-in through a development identity instance, a development secret anyone can read, a missing key that only matters on the first upload. And a production connection string or deploy token left in a developer's shell or a cloud coding session lets any test run or mistyped script change live patient data.

## Decision

- **Staging and production refuse to start** (`assertDeployedSafe` in `src/config/env.ts`) unless: sign-in is Clerk, with Clerk's allowed origins set; production uses a Clerk production key (`pk_live_`); no development secret is set; object storage is S3-compatible storage in an Australian region with its keys present; the trusted client-address secret is set ([0030](0030-security-baseline-from-the-first-route.md)); and the release commit is known. There are no switches that let production start without these.
- **The API checks its own database role at boot** and refuses to serve if it is a superuser, can bypass row-level security, or owns a Medora table ([0006](0006-tenant-isolation-in-the-database.md)).
- **Production keys live only in the deployed services and in GitHub's protected `production` environment.** They are set by hand in the host's dashboard and never pass through a development machine, CI logs or a cloud coding session.
- **Outside a deployed service, the app only connects to a local database.** `src/config/database-guard.ts` stops the process when `DATABASE_URL` or `DATABASE_MIGRATION_URL` points anywhere but a local host, unless `ALLOW_REMOTE_DATABASE=1` is set on purpose for a supervised one-off job against staging. Tests never accept a remote database.
- **Checks on production from a development machine are read-only**, through a read-only role.
- **Two-factor sign-in is on** for every console that can reach production (GitHub, the host, the database, Clerk, AWS, the payment processors), and access is reviewed every quarter.

## Consequences

- A broken setting fails the deploy's health check and never replaces the running release.
- Setting up an environment takes longer, because every key must be in place before it boots.

## Where it lives

- `src/config/env.ts`, `src/config/database-guard.ts`, `src/db/role-check.ts`, `test/unit/env.test.ts`.
