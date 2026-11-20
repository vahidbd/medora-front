# 0012. AI agents act through the API as a role, start switched off, and treat outside text as data

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: AIP-01 to AIP-14
- Regulation: TGA software as a medical device rules; Privacy Act 1988
- Sign-off: needed (AI autonomy)

## Context

Medora launches with an intake agent, a support agent, a care coordinator and a clinical copilot limited to intake summaries and protocol checklists. An agent with its own back door into the database, or with more access than any person, is the fastest way to break every other rule here. An agent that reads patients' messages can also be steered by what those messages say.

## Decision

- **Agents act only through the API**, with the same permission checks, tenant isolation, audit rows and compliance gates as a person. Every route that changes data has a line in the agent tool catalogue or a stated reason it has none, checked in CI.
- **Each agent runs as a named role** with the smallest set of permissions it needs. An unattended job (no person watching) runs as its own read-only role unless an ADR names what it may change.
- **Changes need approval** by default: the agent proposes, a person accepts on an approval card. A tenant can raise an agent's autonomy only within the limits the PRD sets per agent.
- **Text from patients and outsiders is data, never instructions.** Messages, emails and documents reach the model marked as untrusted content, and tools refuse actions that such content asks for unless a person approves.
- **Non-device clinical work only.** No agent diagnoses, prescribes or changes a dose.
- **Every agent starts switched off** per tenant, has a spending cap, and has an eval set that runs before any change to its prompt, tools or model.
- **Models run on Claude through AWS Bedrock in an Australian region** ([0005](0005-patient-data-stays-in-australia.md)).

## Consequences

- An agent can never do more than the role it runs as, and its actions are audited like anyone's.
- Each feature's pull request includes its agent tools, or says why it has none.

## Where it lives

- `src/plugins/route-rules.ts`: a route that changes data names its agent tool, or why there is none.
- The agents module when it is built; `evals/`; the tool catalogue test.
