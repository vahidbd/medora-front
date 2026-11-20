# 0027. Backend modules have a front door from the first module, and one engine per job

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend (the frontend follows the same rule for its features)
- PRD: none
- Regulation: none
- Sign-off: product owner

## Context

A codebase can look modular, with a folder per business area, while every folder reaches into every other folder's files. Then most modules end up in one dependency loop, several modules write the same core tables, and changing an internal function breaks a distant feature. Fixing that after the fact takes a ratchet and months. The same drift produces duplicates: two automation engines, several form kits, a rate limiter per feature, each built by someone who didn't find the first.

## Decision

- **One backend app, split into modules by business area** under `src/modules/<area>/`. Each module has an `index.ts` that names what other code may use: named exports only, no side effects.
- **CI fails on any import that reaches past another module's `index.ts`**, and on any dependency loop between files. The count starts at zero and stays there; there is no baseline (`npm run boundaries`, `.dependency-cruiser.cjs`).
- **Layers:** `src/lib`, `src/config` and `src/db/schema` import no feature. Feature modules reach the database only through `src/db/tenant.ts`, never the raw pool.
- **One owner per core table.** Only the owning module writes it; others call the owner's functions inside the same transaction. A test lists each core table's owner.
- **One engine per job**: one workflow engine, one form kit, one rate limiter, one payments interface, one event outbox, one way to send a message. Building a second one needs an ADR that also says how the first is retired.
- **Files stay small**: lint fails a source file over 400 lines (blank lines and comments not counted).

## Consequences

- A module's insides can change freely; its front door is its contract.
- Some calls that would be one import become a function on the owner's front door. That is intended.

## Where it lives

- `src/modules/*/index.ts`, `.dependency-cruiser.cjs`, `eslint.config.js`, `test/unit/table-owners.test.ts`.
