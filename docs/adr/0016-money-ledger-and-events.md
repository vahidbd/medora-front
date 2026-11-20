# 0016. Money in exact cents on an append-only ledger; events in the same transaction

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: FIN-01, FIN-12, BIL-01, ADH-01
- Regulation: Australian Consumer Law (refunds); tax record keeping
- Sign-off: needed (money)

## Context

Medora charges patients, refunds them, pays pharmacies their share and keeps its own fee, through two payment processors at once. Floating-point money drifts. Running totals updated without a lock lose a posting when two arrive at the same moment. A ledger whose rows can be edited can't show what a balance was last month. Events written after the change commits can be lost, so automations and agents react to things that didn't happen, or miss things that did.

## Decision

- **Amounts are integers in cents** (`bigint`), with a currency code. No floating-point money anywhere; helpers in `src/lib/money.ts`.
- **An append-only ledger.** Every money movement is ledger lines that sum to zero, written once. A mistake is corrected by a reversing entry, so the ledger shows the mistake and its fix. No role may update or delete ledger lines.
- **Postings lock what they change first** (`SELECT … FOR UPDATE` on the account, lowest id first when there are several), and a test posts twice on the same account at once and checks both land.
- **Balances come from the ledger.** A stored balance is a cache that a nightly job checks against the ledger, and against Stripe's and eWAY's records, raising an alert on any difference. It reports; it never corrects.
- **Every money call to a processor carries an idempotency key** and happens after the database commits ([0029](0029-jobs-run-once-and-outside-calls-after-commit.md)).
- **Events go to an outbox in the same transaction as the change** (`emitEvent(tx, …)` in `src/lib/events.ts`). If the change commits, the event exists; if it rolls back, it doesn't. Delivery reads the outbox and retries with backoff. Events carry ids and business facts, never names, contact details or clinical text.
- **Every route that changes data names its events**, or a reason it has none, in the event catalogue.

## Consequences

- Balances can't drift or lose a posting, and any past balance can be worked out from the ledger.
- Correcting money takes two rows instead of an edit, which is what an auditor expects.

## Where it lives

- `src/lib/events.ts` and the `platform.outbox` table now.
- `src/lib/money.ts` and the ledger tables arrive with the billing module.
