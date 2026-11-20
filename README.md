# medora-front

The Medora web app: the staff console today, and the patient app and brand sites as they arrive. Medora is a multi-tenant telehealth operating platform for Australia; the API is `medora-backend`.

Working on the code (you or a coding agent): start with [AGENTS.md](AGENTS.md). How screens look is in [DESIGN.md](DESIGN.md), system decisions in [docs/adr/](docs/adr/README.md), feature rulings in [docs/decisions/](docs/decisions/README.md).

## Local development

Needs Node 22.

```bash
npm ci
npm run dev:preview     # http://localhost:3000 against a mock API, signed in as a made-up owner (dev/README.md)
```

Against the real API, run `medora-backend` on http://localhost:4000 with its seed data, then:

```bash
cp .env.example .env.local   # add a Clerk development instance's keys
npm run dev
```

## Setting up a deployed environment

Staging and production refuse to start until every setting below is safe (ADR 0025, CON8). The error lists what is missing.

Runtime settings:

- `MEDORA_ENV`: `staging` or `production`.
- `BACKEND_URL`: the API's https address, reached from this app's server only.
- `CLERK_SECRET_KEY`: an `sk_live_` key in production.
- `FORWARDED_IP_SECRET`: at least 32 random characters, the same value as the API's.

Build settings (written into the browser's code, so the host passes them to the image build):

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: a `pk_live_` key in production.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: `/sign-in`.
- `NEXT_PUBLIC_MEDORA_ENV`: the same as `MEDORA_ENV`.
- `NEXT_PUBLIC_SENTRY_DSN`: an error tracker that keeps data in Australia (ADR 0026). Optional; unset turns error tracking off.

In Clerk, add the web app's origin to the allowed origins, and set the API's `CLERK_AUTHORIZED_PARTIES` to it.

The image is built from the `Dockerfile` (Railway reads `railway.json`). The host's deploy check reads `/api/health/live`; the uptime check reads `/api/health`, which also covers the API and its database (CON6). The deploy writes the commit to `release-sha.txt` before the build so both answer with it (ADR 0024).

## CI

Every pull request runs the type check, lint, repo checks, unit tests, the production build, the browser tests in preview mode and a dependency audit. The repo checks compare the ADRs, the glossary and the API's contract with `medora-backend`, so CI needs a repository secret, `SIBLING_REPO_TOKEN`: a fine-grained token with read-only access to `medora-backend`'s contents.
