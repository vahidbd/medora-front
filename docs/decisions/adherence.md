# Adherence: the console's adherence flags, and the patient app's part

Rulings for the screens of PRD 12 (ADH-01, ADH-02). How the activity stream and adherence flags work is in medora-backend's `docs/decisions/adherence.md` (ADH1 to ADH10) and ADR 0260; rulings here start at ADH11. Rulings marked "Decided by: stand-in" were decided by the product owner's stand-in while the product owner was away, and are listed in the pull request to confirm.

### ADH11. The patient app says it was opened, and never waits on it

Decision: the signed-in patient frame calls `POST /v1/patient/activity/app-opened` once each time it loads; the API keeps one a day (ADH2). Nothing on screen waits on the call or changes when it fails, and it goes out only after the patient is known and has confirmed their date of birth this sign-in.
Why: opening the app is a signal for the care team, not a step for the patient; a failed signal must never stand between a patient and their care.
