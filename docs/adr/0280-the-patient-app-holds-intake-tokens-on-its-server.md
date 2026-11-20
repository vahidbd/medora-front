# 0280. An intake before an account goes through the patient app's own server, which holds its resume token in a host-only cookie

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: INT-02, IDN-01, IDN-03, APP-01
- Regulation: Privacy Act 1988 (APP 3, APP 5, APP 11)
- Sign-off: needed (patient data, sign-in, the relay's reach)

## Context

A person can start an intake on a brand's patient host before having an account (the backend's `docs/decisions/intake.md` INT5). The API holds such an intake by a resume token: it sends the token once, in the `x-medora-intake-token` header of the reply that starts the intake, never in a body, and keeps only its hash. Every later anonymous call must send it back in the same header, and signing in claims every intake the browser holds (INT6). The relay is the browser's only way to the API and, on a brand's host, reaches only `/v1/patient/*` and needs a session ([0180](0180-each-host-serves-one-surface.md)); an anonymous intake has neither. A token kept where script can read it (memory, `localStorage`, a readable cookie) is one injected script away from someone else's health answers, and patients use shared and family devices.

## Decision

- **A second, narrow way to the API.** On a brand's host the patient app has its own server routes under `/api/start/*` (`src/lib/server/intake.ts`). They reach exactly the API's anonymous intake routes (`/v1/public/intakes`, one intake, one step), the claim (`/v1/patient/intakes/claim`) and account creation (`/v1/patient/account`), and nothing else. Like the relay, they work only on a brand's host (the proxy's `x-medora-brand-host`), name the brand's tenant from the host and never from the browser, pass the visitor's signed address on for the API's rate limits, and answer `no-store`. They take JSON only.
- **The token lives in one cookie the page can't read**: `__Host-medora-intake`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`. The `__Host-` prefix means only this exact host, over a secure connection, can set it, so a sibling brand's subdomain can't set or shadow it. It holds the intake id, program id and token of up to 20 intakes (what one claim takes), oldest dropped first, and lives 14 days from the last answer saved, matching the API's clearing of unclaimed answers (INT7). It never holds an answer or a date of birth. No token ever reaches the page: the server takes it from the API's reply header into the cookie, and from the cookie into the API's request header.
- **Claiming clears it.** The cookie is cleared only after the API has claimed what it held; a refusal keeps it for the next try. An entry is dropped when the API says its intake has lapsed or its token no longer finds it.
- **Account creation names the brand from the host.** The server adds the host's brand to the account's details (the backend's `docs/decisions/patients.md` IDN20), whatever the page sent, then claims what the browser holds, so a patient no more chooses a brand than a tenant.
- **The relay is unchanged**: it still reaches only `/v1/patient/*` from a brand's host. A new anonymous route the patient app needs is added to `/api/start/*` in a pull request that says so, never by widening the relay.

## Consequences

- An injected script on a patient page can drive an intake the browser holds while the page is open, but can't take its token away to use elsewhere or later.
- The patient app keeps one thing in the browser beside the theme (docs/decisions/patient-app.md APP3): an opaque cookie that only this server reads.
- Anyone using the same browser can open an intake held there for up to 14 days without signing in. Whether resuming should first ask for the date of birth, enforced by the API, is owed to the privacy impact assessment (INT17).
- Preview and tests run on `http://*.localhost`, which browsers treat as secure, so the `__Host-` cookie works there too; a host served over plain HTTP elsewhere can't hold an intake.

## Where it lives

- Frontend: `src/lib/server/intake.ts`, `src/lib/server/intake-tokens.ts`, `src/app/api/start/`, `src/proxy.ts` (lets `/api/start/*` through on a brand's host), `src/lib/api/start.ts`, `test/unit/start-routes.test.ts`. Rulings: `docs/decisions/patient-start.md`.
- Backend: the routes in `src/modules/intake/intake.routes.ts` and `src/modules/patients/patient-account.routes.ts`; rulings INT5, INT6, INT7, INT17 and IDN20.
