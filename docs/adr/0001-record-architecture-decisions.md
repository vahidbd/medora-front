# 0001. Record architecture decisions from the first commit

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: none
- Regulation: none
- Sign-off: product owner, 20 Nov 2026

## Context

Medora will hold patient records, prescriptions and money for many tenants, and it will be built by several AI coding agents working in parallel, with one person reviewing. Reasons that live only in chat, or in a file outside the repos, are lost the moment a thread ends. Reasons written up weeks later, all on one day, are reconstructions rather than records.

## Decision

- **Two folders, two jobs.** `docs/adr/` records system-level choices: the stack, hosting, data model, tenancy, data zones, security, money, AI autonomy, delivery, and choices not to do something. `docs/decisions/<feature>.md` records why one feature or screen works the way it does, as rulings with short ids that the code cites.
- **The same ADR files sit in both repos, word for word.** CI fails when the two `docs/adr/` folders differ (`scripts/check-adr-sync.mjs`).
- **An ADR lands in the same pull request as the change it records**, never afterwards. It is numbered after the newest ADR on the pull request's base branch, four digits.
- **When to write one:** a change adds a service or outside provider, or changes how money, sign-in, permissions, tenancy, data zones, audit, deploys or AI autonomy work, or sets a rule every module must follow.
- **Statuses:** Proposed, Accepted, Deferred, Rejected, Superseded by NNNN. An accepted ADR is never rewritten; a new one replaces it. A Proposed ADR that becomes Accepted gets its date and sign-off filled in, nothing else.
- **Who accepts:** an agent may write any ADR as Proposed. An ADR that touches clinical safety gates, data zones, tenant isolation, patient data, money or AI autonomy becomes Accepted only when the product owner approves the pull request that carries it.
- **Format:** the header lists Status, Date, Repos, PRD (the requirement ids it serves), Regulation (the law or standard behind it, or none) and Sign-off. The body has Context, Decision, Consequences and Where it lives. Plain words from the glossary in `AGENTS.md`; no people's names, no secrets, no patient or tenant details.
- **Feature rulings** live in `docs/decisions/` from day one. Each file declares its own id prefix in `docs/decisions/README.md`, so two files never use the same ids. Code cites a ruling as `docs/decisions/<file>.md` plus its id. Comments say why; who asked and when belong in the commit message.

## Consequences

- Anyone with the repo can find why the system has its shape, and an agent can check a plan against the ADRs before writing code.
- Every system-level pull request carries a little more writing. That is the point.
- The ADR sync check needs read access to the other repo (`SIBLING_REPO_TOKEN`). Without it the check fails and says so; it never passes silently.

## Where it lives

- `docs/adr/README.md` (index and rules), `docs/decisions/README.md` (ruling prefixes), `scripts/check-adr-sync.mjs`, the `write-adr` skill in `.agents/skills/`.
