# 0028. The database checks its own rules

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: Records retention, GOV-09
- Regulation: state health records laws (retention)
- Sign-off: needed (patient data)

## Context

When every status is free text, a typo in code is stored without complaint. When notes and messages point at their record by a type and an id with no foreign key, they can point at rows that don't exist, and nothing notices. Wide tables with repeated columns (`email2`, `email3`) and hard deletes that wipe history are hard to undo later.

## Decision

- **Allowed values come from one constant** in `src/db/schema/values.ts`, used by both the code and a CHECK constraint (or an enum) in the database. A test fails if the database's list differs from the constant.
- **Real foreign keys, each with an index.** No pointers by type and id: a note about an order and a note about a consult go through a foreign key each (with a CHECK that exactly one is set) or through separate tables. A catalogue test fails on an unindexed foreign key.
- **Repeated things are rows.** Addresses, phone numbers and emails live in their own tables. A table over 40 columns needs a reason in its migration.
- **Clinical records are never hard-deleted.** They are amended by a new version, with the old one kept, and they are kept as long as the state's health records law requires. A patient's deletion request is handled within those laws, by a reviewed procedure.
- **Plain error replies.** A refused value answers 400 "That value isn't allowed here" and a foreign key 409 or 400, with no table, column or constraint names.

## Consequences

- Adding a status value means changing the constant and adding a migration.
- Some features need a little more schema up front. That is cheaper than cleaning orphans later.

## Where it lives

- `src/db/schema/values.ts`, `src/lib/database-errors.ts`, `test/integration/schema-rules.test.ts`.
