# Admin and staff access in the console

The console's rulings for staff access (the Staff, Roles and Break-glass screens, accepting an invitation and the two-step gate) and for a tenant's set-up (Settings, Companies, Brands and platform staff's screens). The rules they reflect are the API's (ADR 0220; `medora-backend` `docs/decisions/admin.md` ADM1 to ADM8 and ADM14 to ADM20). Ids continue from the backend's file, so they never collide.

### ADM9. The Staff screen says where each membership stands

Decision: the access column shows Active, Paused, Invited (with the day the invitation stops working), Invitation expired, or Ended, worked out once in `src/lib/staff-access.ts` from the status, the invitation date and the end date, because the status alone says neither. An active membership with an end date says "Ends" and the day. Each row's menu offers what the API allows for it: Resend and Withdraw for an invitation, Change role and access and Sign-in history for anyone else, and only Sign-in history on your own row, since nobody changes their own membership (FND6).
Why: an expired invitation and a paused membership look the same in the data and need different actions; one place works it out so the gate, the tenant switch and the list agree.

### ADM10. Pickers offer every role, and the API's refusal shows where the choice was made

Decision: the role pickers list every starting role and every custom role. When the API refuses a choice (a role whose permissions you don't all hold, the last owner, a taken name), the sheet stays open with what was picked and shows the API's message under the form. The screen never decides on its own that a role can't be given.
Why: only the API knows what a person holds once break-glass rules apply (ADR 0220), so a screen that guessed would sometimes hide a role that could be given, or offer one that can't.

### ADM11. An end date is a day, ending at midnight in your own time zone for now

Decision: "Access ends" is picked as a day. It is sent as 23:59:59 that day in the browser's time zone (`endOfDay` in `src/lib/staff-access.ts`). When tenant settings bring a tenant time zone (ADR 0017), the day ends in the tenant's zone instead.
Why: people think of access ending on a day, not at an instant; the tenant's zone isn't stored yet.

### ADM12. Break-glass lives in the topbar, and its reviews have their own screen

Decision: someone whose role holds clinical permissions it can't use on its own sees a Break-glass button in the topbar. It asks for a reason (10 to 500 characters, with a reminder to leave out the patient's details) and, while open, shows "Break-glass until" and the time, with End break-glass. Whoever holds `break_glass:review` gets Workspace, Break-glass: what is waiting for review, or everything, each with its reason, and Mark reviewed with an optional note.
Why: break-glass is about the person's session, not one screen, and someone must read every one of them (PRD ADM-03).

### ADM13. Invitations land on /sign-up, and two-step sign-in is set up at the gate

Decision: the invitation email opens `/sign-up`, Clerk's sign-up card in the console's look. Clerk's sign-up is restricted to invitations, so the page does nothing without one. After it, the sign-in gate asks anyone whose session has no second factor to set one up in their account and sign in again, before any tenant screen opens. The gate also says when an invitation has expired or access has ended, rather than "paused".
Why: the API refuses every tenant call without a second factor (ADM6), so a console that let someone in without one would show only failures.

### ADM21. Platform screens live in the same console, shown only to platform staff

Decision: platform staff get a Platform group in the sidebar (Tenants, Domains to verify), drawn only when `me` says `platformStaff`; the API refuses those routes to anyone else and asks for a second factor (ADM6). Someone who is platform staff but has no tenant of their own lands on Tenants, the tenant switch says "Platform", and tenant screens send them back there. The screens are plain pages with a table, like Staff.
Why: platform staff are few and their work is a handful of steps (create a tenant, verify a domain), so a second app would be machinery for its own sake; one console with one sign-in keeps two-step sign-in and break-glass the same for everyone.

### ADM22. Settings carries the onboarding checklist, and Home repeats it for whoever sets the tenant up

Decision: Settings shows the checklist (company, live brand, medical director, prescriber), each Done or To do with one line on what it needs, and a badge saying whether the tenant takes new patients. Home shows the same card to anyone holding `tenant:manage` while the checklist isn't done. Nothing on it is ticked by hand: the API works it out from the tenant's data, and refuses new patients until it is all done (ADM18).
Why: whoever sets a tenant up should see what is missing where they start the day; a clinician can't act on it, so it would only be noise on their Home.

### ADM23. A brand's status steps are each one action, and a refused one shows the API's reason

Decision: a brand's menu offers the one step its status allows: Go live for a draft, Pause new sign-ups for a live brand, Resume for a paused one, each after a confirm that says what changes for patients (Resume needs none, since it only undoes a pause). When the API refuses (no verified domain, no support email), the toast shows its message and the brand stays as it was. The Domains drawer adds a domain as typed (the API tidies it to a host) and says Verified or Waiting; only platform staff verify, from their own screen.
Why: the rules for going live are the API's (ADM15, ADM16), so the screen offers the step and reports the answer rather than guessing which would pass.

### ADM24. A brand's colour is checked by the API, and the screen shows it as a swatch

Decision: the brand drawer takes a colour as `#rrggbb` beside a swatch of it. The API refuses one that white or near-black text can't be read on at 4.5:1 (`colour_unreadable`), and the drawer shows that message. The Brands table shows each brand's swatch beside its name, and a plain box for a brand with none.
Why: the API holds the rule (ADM17) and the patient app uses the same 4.5:1 rule before it paints with a brand's colour, so the check belongs where the colour is saved, once, not in each screen.
