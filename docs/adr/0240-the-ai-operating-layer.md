# 0240. The AI operating layer: agents run as code-defined roles through the API, from a queue, with fixed safety rails

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: AIP-01 to AIP-15, SUP-02, SUP-06, SUP-07, CON-04
- Regulation: TGA software as a medical device rules; Privacy Act 1988 (APP 1, 5, 8, 11); Spam Act 2003; Do Not Call Register Act 2006; state surveillance and interception laws (voice)
- Sign-off: needed (AI autonomy, patient data, new providers)

## Context

[0012](0012-ai-agents-act-through-the-api-as-a-role.md) sets the principles: agents act only through the API, as a role, off until switched on, with outside text treated as data. Building the launch agents (intake, support, care coordinator, clinical copilot) and AI voice calls needs the concrete rules that make those principles checkable: how an agent proves who it is to the API, where its transcripts live, what it may do without a person, where its work runs, what stops it, and what must be true before a prompt or model change goes live. Patients write free text that can contain health information and can try to steer the model, and voice adds two providers that receive health data.

## Decision

**Identity and tools**

- **A tool is a route.** A route whose config names `agentTool: '<name>'` is an agent tool; its summary and schemas are the tool's description and input. Which agent may use which tool, and each tool's autonomy ceiling, is one typed constant in the agents module, part of the agent's version, reviewed through CODEOWNERS.
- **An agent calls a route in-process** with a credential signed by a key made in memory at boot, never configured, stored or sent out. It names the tenant, the agent, the run, and the permissions for that call: the agent's role narrowed to the staff member it works for, or to the staff member who approved the change. The audit log records actor type `agent`, the run and the approver.
- **Agent roles are system roles in code.** Tenants can't edit them or give them to people. No agent tool changes roles, memberships or permissions.
- **Patient-facing runs are pinned** to one patient, filled by the runtime from the conversation and removed from what the model sees. Only a signed-in chat is a verified patient; email, voice and public chat get help centre answers, message taking and handoff, and no patient-record tools.
- **Nothing a model writes names a tenant, patient or staff member** for the runtime to act on.

**Data**

- Settings and run metadata (ids, codes, numbers, cost in AUD cents) are in `platform`. Transcripts (exactly what went to and came from the model) and approval cards are in `clinical`, and every read of them is audited ([0008](0008-append-only-audit-log.md)). No free text goes into run rows, audit details, events or logs.
- **Patient identifiers are masked** before every model call (name, contact details, address, date of birth, Medicare number), and the transcript stores the masked text. The model never writes a name; the channel's own templates greet the patient.

**Autonomy**

- **Every tool that changes data starts at Approve.** A tenant may raise a tool to Auto only where its ceiling allows. Auto ceilings at launch: the intake agent booking the patient's own consult, the care coordinator sending a nudge from an approved template and booking a review, and handing a conversation to a person (always Auto, can't be turned off). Refunds are Approve only at launch. If that changes, a refund may run without a card only up to the tenant's refund cap, which starts at A$0.
- **An approval card shows exactly what will run**, and what runs is the stored payload, with an idempotency key, through the same route and its checks at approval time. Approving needs the route's own permission and stays within the approver's own access. Cards expire after 7 days.
- **Unattended runs** (scheduled jobs and events, no person watching) may only propose cards, plus the Auto-ceiling tools above when the tenant raised them.
- **Diagnosis, prescribing and dose changes are not tools.** The clinical copilot only restates what the patient answered, with every item citing its answer, and links answers to protocol checklist items whose met or not met comes from the protocol engine.

**Running**

- **Runs queue in `platform.agent_runs`** and a separate worker service (`medora-agents`, the same image) claims them with `FOR UPDATE SKIP LOCKED`, one run per conversation at a time and a limit per tenant ([0029](0029-jobs-run-once-and-outside-calls-after-commit.md)). The claim is the only cross-tenant query. A run whose worker died is marked failed and handed to a person, never resumed. No transaction stays open across a model call.
- **Models are Claude through Amazon Bedrock's Messages endpoint in an Australian region** ([0005](0005-patient-data-stays-in-australia.md)). Each agent's model is pinned in its definition: the smallest that passes its evals. A refusal, error or timeout hands the conversation to a person.

**Safety rails, outside the model**

- **A safety screen** runs on every inbound patient message, before the model: emergency and self-harm language gets fixed text (000, Lifeline 13 11 14) and an urgent handoff, and the agent stays out of that conversation until a staff member hands it back. The terms and wording are platform-owned and part of every agent's version. A request for a person is honoured the same way, without the urgency. Tenants adding terms of their own comes later; they will never remove the platform's.
- **Disclosure is fixed text**: patients are told they are talking to an AI agent, by name, at the start, every automated message is labelled, and a person is always one control away ("Talk to a person", "press 0").
- **Limits**: a monthly spend cap per agent per tenant, replies per day and per conversation, steps and seconds per run, each within platform maxima in code. Every limit ends in a handoff with a reason code.
- **Kill switches**: per agent, per tenant and platform-wide, checked when a run is claimed, before every model call and before every tool call. While an agent is off its cards can be rejected but not approved.

**Change control**

- **An agent's version** is a hash of its prompt, tools, policy, model id and parameters, and the safety screen. An agent can be switched on, and its runs run, only when its current version has a recorded passing eval result, in every environment. CI fails when a recorded result is for an older version, so a change can't merge with stale results. Results are recorded against Claude on Bedrock only. Safety cases pass at 100% in every CI run. Eval cases are synthetic; no patient or staff text is ever committed.

**Voice**

- AI voice calls ([0020](0020-phone-video-and-ai-voice-consults.md)) use Twilio in its Australian region for the call, and Amazon Transcribe and Amazon Polly in ap-southeast-2 for speech. No audio is stored anywhere; the written transcript is the record, and the opening says so. Voice is built only once Twilio confirms in writing that media streams keep audio in Australia, and the AWS AI services opt-out policy is set on the account. Outbound calls use approved scripts with no clinical detail, only to numbers with recorded consent, within platform calling hours in the patient's time zone. A voice call never counts as a consult.

## Consequences

- An agent can never do more than a person in its role, and an agent's change is audited like a person's, with the approver named.
- Each feature that wants an agent to use it declares `agentTool` on its own route, with a name agreed with the agents module; nothing reaches into another module's tables.
- Patient chat answers a moment after the message, through a queue, rather than streamed; voice runs live in the worker service.
- Changing a prompt, a tool or the model means re-running evals with staging credentials before it can merge or run.
- Staging and production run a second service, `medora-agents`.
- Owed before the first patient: the product owner's sign-off on the safety screen's terms and wording, a legal check of the voice announcement and of keeping transcripts, the patient notice for AI processing in the privacy impact assessment, and a retention period for transcripts.

## Where it lives

- `src/modules/agents/` (definitions, policy, runtime, cards, settings, safety screen), `src/plugins/agent-tools.ts` (the catalogue), `src/lib/agent-credential.ts` and `src/plugins/auth.ts` (the agent actor), `src/db/agent-runs.ts` (the claim), `src/agents.ts` and `railway.agents.json` (the agents service).
- The agent tables and `platform.claim_agent_runs` in `src/db/migrations/`; `evals/`, `scripts/evals.ts` and `scripts/check-evals.ts`.
- `docs/decisions/agents.md` (AGT rulings), `docs/providers.md`.
