# 0019. Stripe and eWAY behind one payments interface

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend
- PRD: BIL-01, FIN-12
- Regulation: PCI DSS (card data never touches Medora's servers)
- Sign-off: product owner, 20 Nov 2026

## Context

Tenants need Stripe and eWAY, and one tenant may use both at the same time: one processor for some brands, programs or payment methods, the other for the rest.

## Decision

- **One `payments` interface** with an adapter per processor. Feature code never calls a processor's SDK directly.
- **A tenant can switch both on at once.** Settings choose which processor each brand, program or payment method uses.
- **Card details go straight from the browser to the processor** (hosted fields or a hosted page). Medora stores tokens, never card numbers.
- **Every processor call carries an idempotency key**, and webhooks from both are verified, stored, and processed idempotently.

## Consequences

- Adding a third processor is an adapter, not a change to billing.
- Features that only one processor offers are behind a capability flag on the adapter.

## Where it lives

- The billing module's `payments` adapters when they are built.
