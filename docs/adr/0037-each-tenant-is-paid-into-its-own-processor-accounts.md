# 0037. Each tenant is paid into its own processor accounts

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: BIL-01, FIN-12, TEN-08; non-goal "becoming a licensed payment acquirer"
- Regulation: PCI DSS; Australian payment facilitator and stored value rules (Medora holds no patient money)
- Sign-off: needed (money)

## Context

Each tenant is its own business, and a tenant can be several companies (TEN-08), each with its own bank account and books. Patients pay a tenant, not Medora. If patients' money landed in an account of Medora's and was paid on to tenants, Medora would be holding other businesses' money, with the licensing, trust and dispute duties that brings, which the PRD rules out. Stripe offers a platform model (Connect) in which the platform opens and acts on a business's own Stripe account without holding its keys. eWAY has no platform model: each merchant has its own API key and password. ADR 0019 puts both behind one payments interface.

## Decision

- **A payment account is a tenant's own account at a processor** (`operational.payment_accounts`), and it names the company it pays into. Patients' money goes straight into it and never passes through an account of Medora's.
- **Stripe through Connect, with Standard accounts and direct charges.** Medora opens the account for the tenant and sends a staff member to Stripe's own onboarding pages to finish it, so business, bank and identity details never reach Medora. Medora stores only Stripe's account id. Saved cards, charges and refunds are made on the tenant's account. Medora's platform key (`STRIPE_SECRET_KEY`) is the only Stripe key Medora holds; a tenant never hands Medora its own Stripe keys. A platform fee on charges is a later decision.
- **eWAY with the tenant's own key and password**, encrypted with the tenant's data key ([0010](0010-field-encryption-per-tenant.md)) and never shown again once saved (to come with eWAY payment accounts).
- **One processor account belongs to one payment account in all of Medora** (a unique index across tenants), so a processor's event finds its tenant by the account it names. A payment account's processor account id is set once; the database refuses to change it.
- **A payment account is closed, never deleted.** Closed accounts take no new subscriptions, and the ones they have carry on.
- **Live payment keys stay in production.** Production refuses to start without a live Stripe key, and every other environment refuses one ([0025](0025-production-refuses-unsafe-settings.md)). A deployed service with a Stripe key also needs `CONSOLE_URL`, the staff console's https address that Stripe sends staff back to.
- **A fake processor stands in outside deployed services when there is no key**, and tests never have one. A deployed service never uses the fake: without a key it refuses Stripe work rather than pretend.
- **Only people decide where a tenant's money goes.** No agent tool adds, connects, closes or changes a payment account ([0012](0012-ai-agents-act-through-the-api-as-a-role.md)).

## Consequences

- Medora never holds patients' money. Disputes, chargebacks, payouts and the processor's own fees are between the tenant and its processor, and finance reconciles each payment account against that processor's statements (FIN-03).
- A split across companies (FIN-12) is a choice of payment account per price, with what is owed to another company, such as a pharmacy's share, recorded in the ledger and paid out; one card charge is never split across processor accounts.
- Onboarding needs someone at the tenant to finish Stripe's pages; Medora can't finish it for them. Connecting a Stripe account the tenant opened elsewhere is not supported yet.
- Stripe sends every connected account's events to one platform address; routing them to tenants by account id comes with the processor events.

## Where it lives

- `operational.payment_accounts` and migration `0004_payment_accounts.sql`.
- `src/modules/payments/`: the payments interface (`processor.ts`), the Stripe adapter (`stripe.ts`), the fake (`fake-processor.ts`) and how one is chosen (`processors.ts`).
- `paymentProblems` and `deployedProblems` in `src/config/env.ts`; `test/unit/env.test.ts`, `test/unit/stripe.test.ts`, `test/integration/payment-accounts.test.ts`.
- Rulings BIL8 to BIL12 in `docs/decisions/billing.md`.
