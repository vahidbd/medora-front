---
name: write-adr
description: Write or supersede a Medora architecture decision record in both repos. Use when a change adds a service or provider, changes money, sign-in, permissions, tenancy, data zones, audit, deploys or AI autonomy, or sets a rule every module must follow.
---

# Write an ADR

An ADR records a system-level decision so the next person doesn't undo it by accident. The rules are in `docs/adr/README.md`; this is the procedure.

## 1. Decide that it is an ADR

It is an ADR when the change does any of these (ADR 0001):

- adds a service or an outside provider;
- changes how money, sign-in, permissions, tenancy, data zones, audit, deploys or AI autonomy work;
- sets a rule every module must follow.

If it only explains why one feature works the way it does, write a ruling in `docs/decisions/<feature>.md` instead and stop here.

## 2. Read what is already decided

- Read the index in `docs/adr/README.md` and every ADR in the area.
- If your decision contradicts an **Accepted** ADR, you are superseding it. Never edit the accepted file's body. Your new ADR says which one it replaces, and the old file's Status line becomes `Superseded by NNNN` (the only edit an accepted ADR ever gets).
- If it contradicts a **Proposed** ADR, say so to the person who gave you the task before changing it.

## 3. Write it

- Number: one after the newest ADR on the pull request's base branch, four digits. File: `docs/adr/NNNN-kebab-case-title.md`.
- Use the template in `docs/adr/README.md`. The title is the decision itself, in sentence case.
- **Context**: the facts that force a choice. No answer yet.
- **Decision**: rules someone could check against the code. Name tables, files, roles and checks.
- **Consequences**: what gets easier, what gets harder, what is now owed (tests, gates, follow-up ADRs).
- **Where it lives**: the files, tables and CI checks that hold the decision. Each one must exist by the time the pull request merges, or be marked "to come" with the ADR or pull request that will add it.
- Words from `GLOSSARY.md`. No people's names, tenant names, secrets, patient details or other products' names (`npm run check` fails on blocked names).
- Status `Proposed`. The Sign-off line says `needed (…)` when the ADR touches clinical safety gates, data zones, tenant isolation, patient data, money or AI autonomy; the product owner's approval of the pull request makes it Accepted.

## 4. Put it in both repos

- Add the row to the index table in `docs/adr/README.md`, and a timeline line if the README has one for the date.
- Copy the ADR file and the README to the same paths in the other repo (`medora-backend` and `medora-front`), byte for byte, in a pull request there. `scripts/check-adr-sync.mjs` fails CI when they differ.
- Name the ADR in the pull request's "Follows" line.
