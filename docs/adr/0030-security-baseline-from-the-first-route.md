# 0030. Security baseline from the first route

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Access, Security assurance
- Regulation: Privacy Act 1988 (APP 11)
- Sign-off: needed (permissions)

## Context

The common holes in a web platform are known: a person who can manage roles makes themselves an administrator, rate limits keyed on an address the caller can forge, a page without security headers that can be framed or inject script, an API whose list of routes is public, outbound calls to addresses a user typed that reach the internal network, stored HTML drawn as it is, and records reachable by id without checking who owns them.

## Decision

- **Granting access:** only someone who holds a permission may grant it; nobody may change their own roles; some active person in every tenant always holds full access. These rules live in `src/lib/permissions.ts` and are tested.
- **Record-level checks:** anything attached to a record (notes, files, messages, tasks) needs that record's permission, and a patient reaches only their own records.
- **One rate limiter** (`src/lib/rate-limit.ts`), backed by Postgres so every API copy counts the same attempts, keyed on a trusted client address. The address comes only from `request.clientIp`: one the web app signs with `FORWARDED_IP_SECRET`, then the host's edge header, then the socket. Never the first `X-Forwarded-For` entry. Lint refuses `request.ip`.
- **Security headers everywhere**: a strict content security policy, HSTS, `frame-ancestors 'none'` (except pages built to be embedded), no MIME sniffing, a strict referrer policy.
- **The browser never holds an API token.** Staff and patient screens call the web app's own server, which reads the session from an httpOnly cookie, attaches the token and forwards the request to the API. The API sends no CORS headers, and its OpenAPI document and docs page are served only outside staging and production.
- **Outbound calls to configured addresses** (webhooks a tenant sets up, workflow HTTP steps) go through one guarded fetch that refuses private addresses, re-checks every redirect, times out and caps the reply size.
- **Stored HTML is made inert** before it is drawn, and uploads have size and type limits checked on the server.
- **Secrets are compared in constant time**, and every webhook's signature is checked before its body is read.

## Consequences

- New routes inherit these by default; opting out of any needs a ruling.
- A security change is reviewed by the product owner (CODEOWNERS).

## Where it lives

- `src/lib/permissions.ts`, `src/lib/client-ip.ts`, `src/plugins/client-ip.ts`, `src/lib/rate-limit.ts`, `src/plugins/security-headers.ts`, `eslint.config.js`; frontend `next.config.ts` (headers) and `src/lib/server/relay.ts`.
