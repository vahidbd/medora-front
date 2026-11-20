# 0032. One word per thing, from the database to the screen

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Principle 4 (one core with brand config)
- Regulation: none
- Sign-off: product owner

## Context

When the database and the API use one set of words and the screens another, every developer and every agent has to translate, and translations drift. When a product, a brand or an assistant is renamed, old names linger in comments, environment variables and file names for months. And names of other products in a codebase confuse readers about what the code is for.

## Decision

- **One word per thing**, from the glossary in `GLOSSARY.md`, used the same in table names, API fields, routes, code and screens. A word changes everywhere at once, with a migration where stored values change, or not at all.
- **Statutory words stay statutory** in the output a law prescribes, and are translated on screens.
- **Brand, tenant and agent names are data, never code.** Code, tests and fixtures use made-up tenants and brands.
- **Kebab-case file names** with dot-separated role suffixes (`patient-intake.service.ts`, `patients.routes.ts`), checked in CI (`scripts/check-file-names.mjs`).
- **Other products' names never appear** in either repo. CI checks every tracked file against a list of blocked names stored only as hashes (`scripts/check-names.mjs`), so the check itself names nothing.

## Consequences

- Screens, API and database read the same, so there is no mapping layer to maintain.
- Renaming something is a real change with a migration, which discourages casual renames.

## Where it lives

- `GLOSSARY.md` (the same file in both repos), `scripts/check-file-names.mjs`, `scripts/check-names.mjs`, `scripts/blocked-names.json`.
