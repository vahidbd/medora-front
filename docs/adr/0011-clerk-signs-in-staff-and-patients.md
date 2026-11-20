# 0011. Clerk signs in staff and patients

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: IDN-01, IDN-07, ADM-06, Access
- Regulation: Privacy Act 1988 (APP 8 for account details held overseas)
- Sign-off: product owner, 20 Nov 2026

## Context

Running sign-in in-house means storing passwords, handling resets, second factors and passkeys, and keeping up with attacks on all of them. A hosted sign-in service does that, at the cost of holding account details with a provider.

## Decision

- **Clerk signs in staff and patients**: passkeys, one-time codes, and second factors required by role for staff.
- **Clerk proves who someone is; Medora decides what they may do.** The API verifies each Clerk session token against Clerk's published keys, checks the token was issued for a Medora app (`azp`), then loads the person's tenant memberships, roles and permissions from its own tables.
- **Clerk holds account details only** (name, email, phone, sign-in methods). It never receives health data. Clerk keeps them in the US, so the privacy policy names Clerk as an overseas recipient.
- **Staging uses a Clerk development instance; production must use a production instance with public sign-up closed for staff.** Production refuses to start with a development key ([0025](0025-production-refuses-unsafe-settings.md)).
- **Tests and local development** sign tokens with a development secret (`AUTH_MODE=dev`), which staging and production refuse.

## Consequences

- Medora stores no passwords.
- Sign-in depends on Clerk being up.

## Where it lives

- Backend `src/plugins/auth.ts`, `src/lib/clerk.ts`, `src/config/env.ts`; frontend `src/proxy.ts` and the Clerk provider.
