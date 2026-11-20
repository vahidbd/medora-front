# AI agents in the console

The console's rulings for Medora's own AI agents: the Agents, Approvals and Agent runs screens. The rules they reflect are the API's (ADR 0240; `medora-backend` `docs/decisions/agents.md` AGT1 to AGT17). Ids continue from the backend's file, so they never collide.

Rulings marked "Decided by: stand-in (Fable 5.2), to confirm with Vahid" were decided while the product owner asked not to be waited on, and are listed in the pull request under "Decisions to confirm".

### AGT18. Three screens: Agents, Approvals and Agent runs

Decision: Workspace holds Agents (each agent, whether it runs and why not, its eval result, this month's spend and today's runs, with Pause all agents) and Agent runs (what each run cost and how it ended). Approvals is its own sidebar group, above Workspace, because it is daily work rather than setup. Agents and Agent runs need `agents:read`; changing an agent, pausing and resuming need `agents:manage`, and without it the agent sheet is read-only and says only an owner can change agents.
Why: settings, the work agents hand to people, and what agents did are read by different people at different moments. One screen each keeps each one simple.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### AGT19. Every staff member has the Approvals inbox

Decision: Approvals needs no permission of its own. The API lists only the proposals the signed-in person could make themselves (AGT12) and checks again when they approve, so a pharmacist sees order proposals and a receptionist sees bookings. An empty inbox says "Nothing waiting for you". Waiting and Decided are two tabs of the same list.
Why: a proposal is approved with the approver's own access, so the tool's permission already says who may see it. A separate inbox permission would be a second list to keep in step.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### AGT20. An approval card shows exactly what will run, and text and numbers can be corrected

Decision: the card lists the proposal's input, labelled in plain words. Text and numbers can be edited before approving, and the button then says "Approve with changes", which sends the whole edited input as `finalInput`. Amounts in cents are edited in dollars. Times, lists and nested values are shown as they are and are approved or rejected, not edited. The patient a proposal is for is set by the API from the conversation and is never shown as a field or changed here. Rejecting asks for one of the API's reasons, which the agent is told on its next run. A decided card shows the outcome, when and the reason, and the input that actually ran.
Why: AIP-13 asks that a person can correct a proposal rather than reject and wait for another. A time or a nested value edited in a plain text box is too easy to get wrong.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### AGT21. A transcript is fetched each time it is opened and never cached

Decision: only someone holding `agents:transcripts` sees "See transcript" on a run. The transcript is read when the sheet opens, with no background refetch and no retry, and dropped from the query cache as soon as the sheet closes (`gcTime: 0`). The footer says names and contact details were masked before the model saw them.
Why: each read writes an audit entry (AGT9), so a background refetch would log reads nobody made, and a transcript kept in memory after it closes is clinical data the person is no longer looking at.

### AGT22. The refund cap appears only when refunds may run without approval

Decision: the agent sheet shows "Largest refund without approval" only when the API says `request_refund`'s ceiling allows auto. At launch refunds always wait for approval (AGT7), so the field doesn't appear.
Why: a limit on something that can't happen reads as if it could.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### AGT23. Agent runs shows the latest 50, without filters for now

Decision: Agent runs lists the latest 50 runs, newest first, with no filters or paging. The API already takes agent, status and a cursor; the screen adds them with the shared list engine.
Why: at launch the runs are few and the first question is "what just happened". A one-off filter bar here would be replaced by the shared one.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### AGT24. The mock API has a third tenant for the medical director's view

Decision: preview mode adds "Northside Clinic (demo)", where the made-up signed-in person is a medical director. There they can read transcripts without break-glass; at Harbour, as owner, they can't, because transcripts are clinical. Both tenants' agents, proposals and runs are made up.
Why: the browser tests run in parallel against one mock, and opening break-glass in one test would change what the others see.
