# 0026. Observability from the first deploy

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Availability, Audit
- Regulation: Privacy Act 1988 (APP 8, APP 11)
- Sign-off: needed (patient data leaves the app in error reports)

## Context

Without error tracking, request logs or alerts, a crashing job or a failing route is seen only by whoever happens to read the log stream, and an outage is found by a customer. Error reports are also a common way health data leaks to a third party: a request body, a query string or a local variable in a stack trace.

## Decision

- **Errors are reported through the Sentry SDK** on the API, workers and the web app's server. The server they go to must be in Australia: a self-hosted, Sentry-compatible server in Sydney until the privacy impact assessment approves anything else ([0005](0005-patient-data-stays-in-australia.md)).
- **Scrubbed before sending.** No request or response bodies, headers, cookies, query strings, IP addresses, local variables or SQL parameters. Emails and runs of eight or more digits are masked in messages. Database and validation errors go as their code and the field, never their message.
- **Reporting never changes what a request or job does**: it can't throw, sends in the background, and sends the same error at most once per ten minutes per process.
- **One structured log line per request**: route pattern (never the address as typed), status, time taken, tenant id and user id. Logs pass through a redactor that drops known personal and health fields. `console` is banned in `src/` by lint.
- **Uptime checks** every minute on the API's `/health/ready` and the web app's `/api/health`, and a heartbeat from each scheduled worker, alerting a person when one stops.
- **Patient pages never load error tracking in the browser**; their errors are seen on the server.

## Consequences

- Faults are seen without anyone reading logs.
- Running the error-tracking server in Sydney is one more service to keep up.

## Where it lives

- `src/lib/error-tracking.ts`, `src/lib/redact.ts`, `src/plugins/request-log.ts`, `eslint.config.js`; frontend `src/instrumentation.ts`.
