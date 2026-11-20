# GLOSSARY.md format

Medora has one glossary, `GLOSSARY.md` at the root of each repo, with the same words in both (ADR 0032). It is a set of tables grouped by area:

```md
## Care

| Thing | We call it | Never |
| --- | --- | --- |
| A real-time video or phone appointment with a clinician | **Consult** | appointment (except when booking), session, call |
```

## Rules

- **Be opinionated.** When several words exist for one thing, pick one and list the others under "Never".
- **Describe the thing, not the code.** One short sentence of what it is. No table names, columns or implementation detail.
- **Only Medora's own concepts.** General programming terms don't belong.
- **The word is used everywhere.** Tables, API fields, routes, code, tests and screens all use the "We call it" word. An outside system's own word (Parchment's, a payment provider's) is translated at the edge where it enters Medora.
- **Change both repos.** A new or changed word goes into `GLOSSARY.md` in `medora-backend` and `medora-front` in the same pull request as the code that needs it.
- **No people's names, tenant names or patient details.**
