# 0020. Real-time consults by phone and video from launch, plus AI voice calls

- Status: Accepted
- Date: 20 Nov 2026
- Repos: backend and frontend
- PRD: CON-01, CON-03, AIP-11
- Regulation: Medical Board of Australia telehealth guidelines
- Sign-off: product owner, 20 Nov 2026

## Context

A script needs a real-time consult with the prescriber, and the consult must be recorded as evidence. Patients need both phone and video.

## Decision

- **Phone consults through Twilio.** Medora places or bridges the call and logs it (who, when, how long) as the consult's evidence.
- **Video consults on an open-source media server Medora hosts in Sydney**, so media never leaves Australia.
- **AI voice calls** (reminders, booking, support) use the same telephony, run as an agent under [0012](0012-ai-agents-act-through-the-api-as-a-role.md), and never count as a consult.
- **Recording audio or video**, or transcribing it, needs the patient's consent for that consult; the AI scribe waits for that consent flow.

## Consequences

- The consult gate can rely on Medora's own record of the call.
- Medora runs and monitors a media server.

## Where it lives

- The consults module when it is built.
