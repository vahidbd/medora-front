# 0120. Video consults run on a self-hosted LiveKit server in Sydney, and its signed webhooks are the only video evidence

- Status: Proposed
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: CON-01, CON-03
- Regulation: Medical Board of Australia telehealth guidelines; Privacy Act 1988 (APP 8, APP 11)
- Sign-off: needed (clinical safety, a new provider)

## Context

[0020](0020-phone-video-and-ai-voice-consults.md) puts video consults on an open-source media server Medora hosts in Sydney, and [0009](0009-compliance-gates-in-the-backend.md) lets a script follow only a recorded real-time consult. The gate needs to know, from something it can trust, that the patient and the prescriber were in the same call and for how long. A hosted video service would send media and call data offshore ([0005](0005-patient-data-stays-in-australia.md)) and would be one more party able to say a call happened.

## Decision

- **LiveKit**, the open-source (Apache 2.0) media server, **self-hosted in Sydney** with its built-in TURN, so media and signalling stay in Australia. Not LiveKit Cloud.
- **Medora makes every room and join token, on the server.** Tokens are short-lived and good for one room. The room is named `consult:<tenant id>:<consult id>` and a participant's identity is `patient:<patient id>` or `clinician:<user id>`. No names or other patient details go to the server.
- **The server's webhooks are the only source of video consult evidence.** They come to one address, `/v1/webhooks/video`, signed with Medora's API secret (a token carrying the body's hash), are checked, stored in the webhook inbox ([0029](0029-jobs-run-once-and-outside-calls-after-commit.md)), and become evidence there (`docs/decisions/consults.md` CNS2 to CNS7). The tenant comes from the room's name, so one server serves every tenant without a lookup across tenants.
- **Nothing is recorded or streamed out** (no egress). Recording waits for its own consent flow ([0020](0020-phone-video-and-ai-voice-consults.md)).

## Consequences

- The gate trusts only callbacks signed with a secret Medora holds, from a server Medora runs. Anyone holding that secret could forge evidence, so it is a production secret like a database password.
- Medora runs, scales, patches and monitors a media server and its TURN service, and the launch checklist has to cover it.
- Evidence arrives when the server's webhook does. A consult counts once someone leaves or the room closes (CNS4), not while the call is open.

## Where it lives

- Backend: `src/modules/consults/` (`video-room.ts`, `video.routes.ts`, `evidence.service.ts`, `gate.service.ts`), `clinical.consults` and `clinical.consult_evidence`, `VIDEO_API_KEY` and `VIDEO_API_SECRET` in `src/config/env.ts`, `test/integration/consult-gate.test.ts`.
- Room creation, join tokens and the video screens arrive with the video consult pull request.
- Rulings: `docs/decisions/consults.md`. Provider: `docs/providers.md`.
