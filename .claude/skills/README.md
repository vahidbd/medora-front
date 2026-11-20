# Skills

Skills for coding agents working on Medora. `.agents/skills/` is the source; `.claude/skills/` is an exact copy so Claude Code finds them too. Change a skill here, then run `npm run skills:sync`; CI fails when the two differ (`scripts/check-skills.mjs`).

| Skill | Use it to |
| --- | --- |
| `grill-with-docs` | Interview the person about a plan before building, writing glossary words and ADRs as answers settle |
| `grilling` | Interview the person about a plan, one question at a time, with a recommended answer for each |
| `grill-me` | The same interview, when the person asks for it by name |
| `domain-modeling` | Challenge and sharpen words against `GLOSSARY.md`, and decide when a choice needs an ADR |
| `write-adr` | Write or supersede an ADR in both repos |
| `tdd` | Build test first, at agreed seams |
| `diagnosing-bugs` | Build a red-capable feedback loop before forming a theory about a bug |
| `review-change` | Review a branch on two axes: our written standards, and what the change was asked to do |
| `codebase-design` | Shared words for module depth, seams and interfaces |
| `prototype` | Build a throwaway prototype to answer a design question |
| `writing-for-agents` | Write instructions, skills and docs that agents follow well |

## Where they came from

All but `write-adr` started as copies of the MIT-licensed skills at https://github.com/mattpocock/skills, commit `abeeaf95660ba9e8b7c753eb38f441ca707a8823`. The licence is in `LICENSE-upstream`. They are pinned copies, not a plugin, so they only change when a pull request changes them.

Changes made for Medora:

- `domain-modeling`: one glossary in table form (`GLOSSARY-FORMAT.md`), Medora's ADR rules (`ADR-FORMAT.md`), and a pointer to `write-adr`.
- `review-change` (upstream `code-review`, renamed so it doesn't clash with Claude Code's built-in): the spec comes from the pull request description and rulings, not an issue tracker, and the standards always include `AGENTS.md`, `GLOSSARY.md`, the ADRs, the rulings, `DESIGN.md` and the "Hit every surface" list.
- `tdd`: when the person is away, pick the seams and list them in the pull request.
- `diagnosing-bugs`: redact patient details as well as secrets, and never use production data in a repro.

To take a newer upstream version, diff the upstream folder against this one, keep the Medora changes above, update the commit here, and say so in the pull request.
