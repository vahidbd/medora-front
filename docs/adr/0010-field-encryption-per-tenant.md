# 0010. Intake answers and notes are encrypted per field, with each tenant's own keys

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend
- PRD: TEN-02, Encryption
- Regulation: Privacy Act 1988 (APP 11)
- Sign-off: needed (patient data)

## Context

Disk encryption protects against a stolen disk, not against a leaked database dump, a misdirected backup or an over-broad query. The most sensitive fields (intake answers, consult notes) need a second layer, and one tenant's key must not open another tenant's data.

## Decision

- **Intake answers and clinical notes are encrypted per field** (envelope encryption: a data key per tenant, wrapped by a key held in AWS KMS in Sydney).
- **Decryption happens in the API, only for a request allowed to read that record**, and every decryption is an audited read ([0008](0008-append-only-audit-log.md)).
- **Encrypted fields are never searched or sorted in SQL.** Anything that must be searchable is stored separately as a derived, non-clinical value.

## Consequences

- A database dump alone reveals no intake answers or notes.
- Key rotation and a lost key are operational procedures written before the first patient.

## Where it lives

- The clinical module's storage layer when it is built.
