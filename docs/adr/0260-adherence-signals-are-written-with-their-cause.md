# 0260. Adherence signals are written with the action that causes them

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: ADH-01, ADH-02
- Regulation: Privacy Act 1988 (APP 11)
- Sign-off: needed (patient data, clinical safety, permissions)

## Context

The adherence engine needs two things from every module a patient touches: a stream of what the patient did (opened the app, recorded readings, reported a side effect, checked in, sent a message, placed an order), and adherence flags the care team acts on, the first raised by a side effect report. Events go to the outbox in the same transaction as their change ([0016](0016-money-ledger-and-events.md)), but they are delivered later, at least once, by a job that can lag or stop ([0029](0029-jobs-run-once-and-outside-calls-after-commit.md)). A severe side effect whose flag waits on delivery can sit unseen for as long as delivery is down. How a patient keeps up with a program is also health information: that they are a brand's patient at all says what they are treated for ([0007](0007-three-data-zones.md)).

## Decision

- **A module that records a patient's own action calls `recordActivity`** from `src/modules/adherence/index.ts` in the same transaction as the action, naming the record it wrote. Actions a staff member or an agent takes for the patient are not the patient's activity, and `recordActivity` writes nothing for them.
- **Anything a person must act on for a patient's safety is written with its cause**, in the same transaction, never by a handler that reacts to an event. The first is the adherence flag a severe or moderate side effect raises; later rules (a missed check-in, no tracking for two weeks) that run on a schedule write their flags in the job's own transaction. The event still goes out for anyone else who reacts.
- **Activity and adherence flags are clinical-zone data.** Activity is never changed or removed. A flag changes once, from open to resolved; a mistaken resolution is undone by a new flag that reopens it, never by an edit ([0028](0028-the-database-checks-its-own-rules.md)). Every write and every read is audited with ids and facts only ([0008](0008-append-only-audit-log.md)); the patient's words and a resolver's note stay in their rows.
- **Only people resolve or reopen an adherence flag.** The permission that does it is clinical and no agent may hold it ([0012](0012-ai-agents-act-through-the-api-as-a-role.md), [0220](0220-permissions-name-their-zone-and-staff-sign-in-with-two-steps.md)). An agent may know which flags are open, never what the patient wrote.

## Consequences

- A severe report can't exist without its flag, and a flag can't outlive a rolled-back report.
- Each module that writes a patient action takes a dependency on the adherence module's front door, so the adherence module depends on none of them: the console shows what raised a flag by asking the record's own module.
- Out-of-hours paging for an urgent flag is not decided here; until it is, an urgent flag waits in the console for the next person to look (`docs/launch-checklist.md`).
- Marketing never reads activity. A nudge that needs it gets a named, derived event, under its own ruling.

## Where it lives

- Backend: `src/modules/adherence/`, `clinical.adherence_activity` and `clinical.adherence_flags` with their trigger in `src/db/migrations/0007_adherence.sql`, the calls in `src/modules/tracking/`, `test/integration/adherence.test.ts`. Rulings: `docs/decisions/adherence.md`.
- Frontend: the Adherence screen in the staff console. Rulings: `docs/decisions/adherence.md`.
