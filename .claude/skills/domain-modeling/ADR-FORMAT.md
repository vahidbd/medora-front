# ADR format

Medora's ADRs live in `docs/adr/` and are the same files in `medora-backend` and `medora-front` (CI checks they match). The full rules, the template and the index are in `docs/adr/README.md`; read it before writing one. To write one, call the Skill tool with "write-adr".

## The short version

- Number after the newest ADR on the base branch, four digits: `NNNN-kebab-case-title.md`.
- The title is the decision, in sentence case: "Every row carries a tenant id, enforced by the database".
- Header lines: Status, Date, Repos, PRD, Regulation, Sign-off. Sections: Context, Decision, Consequences, Where it lives.
- Statuses: Proposed, Accepted, Deferred, Rejected, Superseded by NNNN. An accepted ADR is never rewritten; a new one supersedes it.
- An ADR touching clinical safety gates, data zones, tenant isolation, patient data, money or AI autonomy is Accepted only when the product owner approves the pull request that carries it.
- Add a row to the index in `docs/adr/README.md` in the same pull request, in both repos.

## When to offer an ADR

All three must be true:

1. **Hard to reverse**: changing your mind later costs real work.
2. **Surprising without context**: a future reader would wonder why it was done this way.
3. **The result of a real trade-off**: there were genuine alternatives.

On top of that, Medora always needs an ADR for a change that adds a service or outside provider, changes how money, sign-in, permissions, tenancy, data zones, audit, deploys or AI autonomy work, or sets a rule every module must follow (`docs/adr/README.md`, ADR 0001). A choice that only explains one feature goes in `docs/decisions/<feature>.md` as a ruling instead.
