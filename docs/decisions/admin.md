# Admin and staff access in the console

The console's rulings for staff access: the Staff, Roles and Break-glass screens, accepting an invitation and the two-step gate. The rules they reflect are the API's (ADR 0036; `medora-backend` `docs/decisions/admin.md` ADM1 to ADM8). Ids continue from the backend's file, so they never collide.

### ADM9. The Staff screen says where each membership stands

Decision: the access column shows Active, Paused, Invited (with the day the invitation stops working), Invitation expired, or Ended, worked out once in `src/lib/staff-access.ts` from the status, the invitation date and the end date, because the status alone says neither. An active membership with an end date says "Ends" and the day. Each row's menu offers what the API allows for it: Resend and Withdraw for an invitation, Change role and access and Sign-in history for anyone else, and only Sign-in history on your own row, since nobody changes their own membership (FND6).
Why: an expired invitation and a paused membership look the same in the data and need different actions; one place works it out so the gate, the tenant switch and the list agree.

### ADM10. Pickers offer every role, and the API's refusal shows where the choice was made

Decision: the role pickers list every starting role and every custom role. When the API refuses a choice (a role whose permissions you don't all hold, the last owner, a taken name), the sheet stays open with what was picked and shows the API's message under the form. The screen never decides on its own that a role can't be given.
Why: only the API knows what a person holds once break-glass rules apply (ADR 0036), so a screen that guessed would sometimes hide a role that could be given, or offer one that can't.

### ADM11. An end date is a day, ending at midnight in your own time zone for now

Decision: "Access ends" is picked as a day. It is sent as 23:59:59 that day in the browser's time zone (`endOfDay` in `src/lib/staff-access.ts`). When tenant settings bring a tenant time zone (ADR 0017), the day ends in the tenant's zone instead.
Why: people think of access ending on a day, not at an instant; the tenant's zone isn't stored yet.

### ADM12. Break-glass lives in the topbar, and its reviews have their own screen

Decision: someone whose role holds clinical permissions it can't use on its own sees a Break-glass button in the topbar. It asks for a reason (10 to 500 characters, with a reminder to leave out the patient's details) and, while open, shows "Break-glass until" and the time, with End break-glass. Whoever holds `break_glass:review` gets Workspace, Break-glass: what is waiting for review, or everything, each with its reason, and Mark reviewed with an optional note.
Why: break-glass is about the person's session, not one screen, and someone must read every one of them (PRD ADM-03).

### ADM13. Invitations land on /sign-up, and two-step sign-in is set up at the gate

Decision: the invitation email opens `/sign-up`, Clerk's sign-up card in the console's look. Clerk's sign-up is restricted to invitations, so the page does nothing without one. After it, the sign-in gate asks anyone whose session has no second factor to set one up in their account and sign in again, before any tenant screen opens. The gate also says when an invitation has expired or access has ended, rather than "paused".
Why: the API refuses every tenant call without a second factor (ADM6), so a console that let someone in without one would show only failures.
