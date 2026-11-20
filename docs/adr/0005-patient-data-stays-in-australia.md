# 0005. Patient data, backups and AI models stay in Australia

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: Goal 6, Hosting, AIP-07, Vendors
- Regulation: Privacy Act 1988 (APP 8, APP 11); My Health Records Act 2012 where it applies
- Sign-off: product owner, 20 Nov 2026

## Context

Medora stores health information for Australian patients. Sending it overseas is a disclosure the privacy policy must cover and patients must be told about, and some tenants and partners will refuse a platform that does it. Splitting the API, the database and the web servers across regions also adds a slow hop to every request.

## Decision

- **Everything that stores or processes patient data runs in Australia**: the API, workers, database, backups, object storage, the video media server and AI models.
- **Hosting starts on Railway in its Sydney region** and moves to AWS Sydney when scale or compliance needs it, by a new ADR. Backups go to a second Australian region.
- **AI models run through AWS Bedrock in an Australian region.**
- **The web app's servers run in Sydney too**, so the hop from the web app to the API stays in one region.
- **Every new provider is recorded** in `docs/providers.md` with its region and what data reaches it. A provider that would receive health data outside Australia needs an ADR and the privacy impact assessment's approval first.

## Consequences

- Some services Medora uses keep account data overseas (sign-in, for example, see [0011](0011-clerk-signs-in-staff-and-patients.md)). They are listed, named in the privacy policy, and never receive health data.
- Railway's Sydney region must be confirmed when the first environment is created; if it is not available, staging waits rather than starting elsewhere.

## Where it lives

- `railway.json`, `docs/providers.md`, the boot checks in `src/config/env.ts` ([0025](0025-production-refuses-unsafe-settings.md)).
