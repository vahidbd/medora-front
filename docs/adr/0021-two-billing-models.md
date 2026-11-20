# 0021. Two billing models, chosen per tenant or program

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: BIL-01 to BIL-04, FIN-12
- Regulation: Australian Consumer Law; PBS and pharmacy pricing rules where they apply
- Sign-off: product owner, 20 Nov 2026

## Context

Some tenants want one price for the patient (program plus medicine) and pay the pharmacy its share; others want the pharmacy to charge for the medicine itself while Medora charges only consult and program fees.

## Decision

- **Bundled:** Medora charges the patient one price and pays the pharmacy its share and itself its fee, each as ledger entries ([0016](0016-money-ledger-and-events.md)).
- **Pharmacy-billed:** Medora charges consult and program fees only; the pharmacy charges the patient for the medicine.
- **Chosen per tenant, and per program within a tenant.** The model is configuration, not code.
- **Pharmacies use a small partner page** to see their orders and mark them dispensed and shipped with tracking. It is not a pharmacy system ([0013](0013-prescribing-through-parchment.md)).

## Consequences

- Finance reports show margin per program in both models.
- Each order records which model it was sold under, so a later change of model never rewrites history.

## Where it lives

- The billing and orders modules when they are built.
