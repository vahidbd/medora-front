# 0017. Times are stored in UTC and shown in the tenant's or patient's time zone

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: GOV-08
- Regulation: state health records laws; consumer law notice periods
- Sign-off: product owner

## Context

Tenants and patients are spread across Australia's time zones, three of which change for daylight saving and two of which don't. "Today", "tomorrow at 9", reminders, statutory deadlines and business days all depend on whose clock is meant. Code that takes the UTC date when it means the local day is off by one for most of the evening.

## Decision

- **Timestamps are stored as `timestamptz`** and handled as instants.
- **Each tenant has a time zone** (`platform.tenants.time_zone`), and each patient may have their own. Times shown to a person, reminders and "today" use the patient's zone for patient-facing work and the tenant's zone for staff work.
- **Business days count per state**, with that state's public holidays.
- **"Today" comes from one helper** (`localDate(instant, timeZone)` in `src/lib/time.ts`). A lint rule refuses `new Date().toISOString().slice(0, 10)` and its relatives.

## Consequences

- A tenant in Perth and a patient in Hobart each see their own clock.
- Every date calculation needs to know whose zone it is in; the helper's signature makes that explicit.

## Where it lives

- `src/lib/time.ts`, `platform.tenants.time_zone`, `eslint.config.js`.
