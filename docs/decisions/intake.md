# Intake and the protocol engine in the console

The console's rulings for the Protocols and Programs screens and the prescriber's intake summary. The rules they reflect are the API's (`medora-backend` `docs/decisions/intake.md` INT1 to INT18). Ids continue from the backend's file, so they never collide. Rulings marked "Decided by" with a name other than Vahid's are to be confirmed with him.

### INT19. A draft is edited as the protocol's own definition for now

Decision: Edit draft shows the version's definition as JSON in one text box. The API checks it (INT1) and its problems show under the box by path, with what was typed kept. The screens read a definition through a narrow type of their own (`src/lib/protocol-definition.ts`) that shows steps, questions, hard stops and red flags and ignores anything it doesn't know, because the contract types the definition as an open record. A form for building protocols comes later.
Why: the protocol language is the API's and is checked there; a text box ships editing now without a second copy of its rules in the browser, and nothing reaches patients before a medical director signs the version off (INT4).
Decided by: us, to confirm with Vahid

### INT20. Signing off shows the attestation word for word

Decision: Sign off draft shows only to someone who can sign now (`protocols:sign_off`, so an owner opens break-glass first). The drawer takes the signer's Ahpra registration (MED and ten digits) and a tick beside the attestation the API stores, built from the same words (`attestationOf` in `src/lib/protocols.ts`), and says which version retires. Withdrawing the live version takes a reason. The page shows the draft to whoever edits drafts and the live version to everyone else, with every version a click away.
Why: the person signing must read exactly what is recorded against their name (INT4). Showing the draft first to editors puts the work in progress in front of the people doing it.
Decided by: us, to confirm with Vahid

### INT21. Programs change status one action at a time

Decision: Programs lists each program with its brand, protocol, what patients record and status. Going live, pausing and retiring each ask to confirm and say what changes for patients; resuming doesn't. A refusal from the API, such as going live on a protocol with no signed-off version, shows its message. The brand and protocol can't change once a program exists.
Why: going live puts a program on a brand's site and retiring can't be undone, so each needs its own deliberate step. The API owns the rule on signed-off versions (INT9).
Decided by: us, to confirm with Vahid

### INT22. The prescriber's summary is its own page under the patient

Decision: a completed or ineligible intake opens at `/patients/<patient>/intakes/<intake>`. It shows, first, what should change how the rest is read (a date of birth that isn't the patient's, a withdrawn version, answers more than 30 days old), then the outcome with the stopping rule and red flags in the protocol's words for the prescriber, the numbers worked out, the answers in question order with red flags marked, and the patient's earlier hard stops. A role that needs break-glass to read it sees "Break-glass needed" with Try again, never a load failure or an empty page. The patient's record links an intake here only for someone who can read it now.
Why: the prescriber reads this before a consult (INT15), and a warning read after the answers is a warning missed. A refusal that looks like an error would send an owner to report a fault instead of opening break-glass.
Decided by: us, to confirm with Vahid
