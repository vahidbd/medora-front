# 0100. Patients sign in on their own sign-in instance, and hold one record per tenant

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: IDN-01, IDN-03, IDN-07, ADM-06
- Regulation: Privacy Act 1988 (APP 3, APP 8, APP 11)
- Sign-off: needed (sign-in and patient data)

## Context

[0011](0011-clerk-signs-in-staff-and-patients.md) has Clerk sign in staff and patients, with staff sign-up closed in production ([0033](0033-before-the-first-patient.md) item 4). Patients must be able to sign themselves up, by a one-time code to their email or mobile, on any brand's site. One Clerk instance can't have sign-up both closed and open. A token that works for both a staff member and a patient would let a mistake on one side open the other. And one person may be a patient of two tenants, each of which is the data controller for its own patients.

## Decision

- **Patients sign in on a second Clerk instance**, one for the whole platform, with open sign-up, one-time codes by email or SMS, and passkeys. Clerk holds only the email, the mobile and sign-in methods: no name, date of birth, tenant, brand or condition, not even in metadata.
- **Each door takes only its own tokens.** Staff routes verify against the staff instance and refuse a token meant for patients; patient routes verify against the patient instance only (`CLERK_PATIENT_PUBLISHABLE_KEY`, `CLERK_PATIENT_AUTHORIZED_PARTIES`). In development and tests, patient tokens carry `aud: "patient"` and staff tokens must not. Staging and production refuse to start without the patient instance, refuse the staff instance in its place, and production refuses a development key for it ([0025](0025-production-refuses-unsafe-settings.md)).
- **Two access kinds for patient routes** (`src/plugins/route-rules.ts`): `patient-sign-in` (a verified patient token in a tenant, before the record exists or before this session has confirmed the date of birth) and `patient` (the record exists and this session has confirmed the date of birth). Staff permissions never apply to a patient token.
- **One patient record per person per tenant**, in `clinical.patients`, linked to the patient sign-in by its Clerk user id. A person who is a patient of two tenants has two records; nothing about one is visible from the other, including identity checks and consents. Other tables point at a patient by `(tenant_id, patient_id)`.
- **A patient acting on their own record is an actor of its own**: audit entries name them with `actor_type = 'patient'` and the patient's id ([0008](0008-append-only-audit-log.md)).
- **The date of birth is checked on every new sign-in session** before any patient route answers, and when the account is created, with the age limit (18 and over in v1) worked out on the tenant's calendar day ([0017](0017-time-zones-per-tenant-and-patient.md)).

## Consequences

- Staff sign-up stays closed, and a leaked or misrouted token of one kind is useless on the other door.
- Two Clerk instances to configure, monitor and pay for, and the privacy policy names Clerk once for both.
- A patient of two tenants verifies their identity and gives consent twice. That is the cost of each tenant controlling its own records.

## Where it lives

- Backend `src/plugins/patient-auth.ts`, `src/plugins/auth.ts`, `src/db/patient-session.ts`, `src/config/env.ts`, `src/modules/patients/`, `clinical.patients` and `clinical.patient_sign_ins`, `test/integration/patients.test.ts`, `test/unit/env.test.ts`.
- Frontend: the patient app's Clerk provider and relay, when they are built.
- Rulings: `docs/decisions/patients.md`.
