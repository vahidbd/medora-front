# Adherence: the console's adherence flags, and the patient app's part

Rulings for the screens of PRD 12 (ADH-01, ADH-02). How the activity stream and adherence flags work is in medora-backend's `docs/decisions/adherence.md` (ADH1 to ADH10) and ADR 0260; rulings here start at ADH11. Rulings marked "Decided by: stand-in" were decided by the product owner's stand-in while the product owner was away, and are listed in the pull request to confirm.

### ADH11. The patient app says it was opened, and never waits on it

Decision: the signed-in patient frame calls `POST /v1/patient/activity/app-opened` once each time it loads; the API keeps one a day (ADH2). Nothing on screen waits on the call or changes when it fails, and it goes out only after the patient is known and has confirmed their date of birth this sign-in.
Why: opening the app is a signal for the care team, not a step for the patient; a failed signal must never stand between a patient and their care.

### ADH12. Adherence flags sit under Care, for those who may read them

Decision: the console's Adherence flags screen is `/adherence-flags`, the one entry of a new Care group between Home and Workspace. It shows only with `adherence:read`, which is clinical (ADH9 in medora-backend), so an owner who isn't clinical sees it only while break-glass is open. Resolving and reopening show only with `adherence:resolve`, the permission the API checks for both.
Why: hiding is a courtesy and the API refuses on its own (ADR 0009); the sidebar should not offer what the API will refuse.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### ADH13. The list names the patient and the cause; opening one reads the words

Decision: two tabs, Open (urgent first, then oldest) and Resolved (newest resolution first). Columns: patient, cause, urgency, raised, and on Resolved what was done, when and by whom. The patient's words appear only in the sheet that opens a flag, which fetches the flag and its side effect then and never before (no prefetch on hover or list load); a failed read shows its own failed state. No search, filters, timer or sidebar count until a tenant's queue needs them. Rows stay on one line, and the table scrolls inside its card on a phone.
Why: each of those reads is audited (ADH10 in medora-backend); a deliberate open is what the audit should record.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### ADH14. Resolving asks what was done, with no default

Decision: the sheet of an open flag holds the resolve form: one of the four outcomes, none chosen at first ("Choose what was done." if Resolve is pressed without one), and an optional note up to 1,000 characters, never kept in the browser. The toast says only "Adherence flag resolved", with no patient details.
Why: the outcome is a clinical choice and must never be an accident; a toast outlives its screen.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### ADH15. Reopening asks first, and happens once

Decision: a resolved flag shows its resolution and a Reopen button, which asks for confirmation before it calls the API. The sheet then shows the new open flag, with the earlier resolution under "Resolved before, then reopened". A flag already reopened shows "View the reopened adherence flag" instead of Reopen (the API's `reopenedAsId`); the API's refusal still shows if two people race.
Why: a reopening is a clinical record that stays, and a flag is reopened once (ADH7 in medora-backend), so a misclick should not spend it.
Decided by: stand-in (Fable 5.2), to confirm with Vahid
