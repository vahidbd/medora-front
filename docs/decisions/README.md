# Feature rulings

Why one feature or screen works the way it does. System-level choices are in `docs/adr/` instead.

## How it works

- One file per feature: `docs/decisions/<feature>.md`, in the repo that needs it. A file both repos need has the same name in both.
- Each ruling has a short id with the file's own prefix (below), so ids never collide: `INT3`, `RX12`.
- A ruling is written in the same pull request as the code it explains, and the code cites it: `// docs/decisions/intake.md INT3: answers are saved per step, so a dropped connection loses one step at most`.
- A ruling is never rewritten. A new one says which it replaces.
- Comments and rulings say why. Who asked and when go in the commit message.

## A ruling

```markdown
### INT3. Answers are saved per step

Decision: …
Why: …
Replaces: INT1 (optional)
```

## Prefixes

Prefixes are unique across both repos, so this table lists both.

| Prefix | File | Repo | Feature |
| --- | --- | --- | --- |
| FND | `foundation.md` | `medora-backend` | The platform foundation: tenancy, sign-in, audit, health checks |
| CON | `console.md` | `medora-front` | The staff console: sign-in gate, tenant switch, shell, page security, preview mode |
| ADM | `admin.md` | both | Admin, staff access, roles, invitations, two-step sign-in, tenant onboarding |
| CAT | `catalogue.md` | both | Product catalogue and blocked items |
| GOV | `governance.md` | both | Clinical governance: incidents, complaints, deadlines, retention, masking |
| AGT | `agents.md` | both | AI agents: runtime, tools, approval cards, limits, safety screen, evals, launch agents, voice |

Add a row in both repos when you add a file. A prefix is two to four capital letters and is never reused.
