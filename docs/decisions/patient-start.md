# The patient app's start

Rulings for how a person starts care on a brand's patient app: the intake before and after an account, the resume cookie, claiming intakes and creating the account (PRD sections 2, 3 and 11). ADR 0280 sets how the app's server holds an intake's resume token; ADRs 0100 and 0180 and the patient app's rulings (`patient-app.md`) apply throughout, and the intake and account rules themselves are the API's (`docs/decisions/intake.md` and `patients.md` in medora-backend). Rulings marked "Decided by: stand-in" were decided by the product owner's stand-in while the product owner was away, and are listed in the pull request to confirm.

### JOIN1. An intake's resume token is kept in one cookie only this server reads

Decision: the tokens of intakes started in a browser before an account are kept in one `__Host-` cookie, `HttpOnly`, `Secure`, `SameSite=Lax`, holding at most 20 entries of intake id, program id and token, and nothing else: never an answer or a date of birth. It lasts 14 days from the last answer saved and is cleared once the intakes are claimed. This is the one exception to APP3's "nothing in browser storage but the theme", because the API gives an anonymous intake no other way to be found again.
Why: a token script can't read is one an injected script can't carry off; 14 days is how long the API keeps unclaimed answers (INT7), so the cookie never outlives what it points at.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN2. The start flow has its own server routes, and the relay stays as it is

Decision: the browser reaches an anonymous intake, the claim and account creation through `/api/start/*`, which this server answers by calling the API's own routes, and through nothing else. The routes answer only on a brand's host, name the brand's tenant from the host, take JSON only, and answer `no-store`. The relay keeps reaching only `/v1/patient/*` on a brand's host.
Why: widening the relay to anonymous calls would make every patient route's guard depend on the relay's path checks. A handful of named routes is a smaller thing to get right, and JSON-only plus a `SameSite=Lax` cookie means another site can neither post to them nor send the cookie.

### JOIN3. Creating an account names this host's brand, then claims what the browser holds

Decision: account creation goes through this server, which sets the brand to the host's own (IDN20), replacing any the page sent, and then claims the intakes the browser holds. When the claim fails the account still stands and the cookie stays for the next claim.
Why: the domain decides the brand as it decides the tenant (APP2). Claiming in the same request means a new patient's intake is theirs before the next screen loads, and a failed claim costs only a retry, never the account.

### JOIN4. An intake that has lapsed is dropped from the cookie

Decision: when the API says a held intake has lapsed (unclaimed answers cleared, expired, or its protocol version withdrawn) or its token no longer finds it, the entry goes from the cookie. An intake a hard stop ended stays, so it is claimed with the rest (INT6). Past 20 entries the oldest goes.
Why: an entry that can never be opened again is only weight in a cookie with a 4 KB limit, while an ineligible intake is exactly what the prescriber must see.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN5. A start link without a program lists the brand's open programs

Decision: brand sites link to `/start/<programId>`. `/start` on its own lists the brand's programs a person can start now, each by its name and the line the tenant wrote for patients (INT16), and goes straight to the program when there is only one. None open says the brand isn't taking new patients.
Why: a link without a program should still lead somewhere useful, and the list comes from the program's operational details only, never the protocol, so it names no medicine.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN6. The questions come first, and the account after them

Decision: a person answers the intake before making an account. When every step is answered the screen asks them to create an account to send the answers to a clinician, through the same email-code sign-in that also signs up (APP5), and comes back to the same program after. The screens that end an intake offer no sign-up; every start screen keeps a way to sign in.
Why: this is the PRD's journey, and the API asks for an account only to submit (INT12). Asking for an account first loses people before they know whether the care suits them.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN7. Coming back picks up where the person left off

Decision: opening a program's start page while this browser holds an intake for it goes straight back to its first unanswered step, with one line saying the earlier answers were kept. Starting again isn't offered. When the API says the held intake has lapsed (JOIN4), the first screen shows again with one line saying the answers weren't kept.
Why: a second intake for the same program only splits the person's answers, and a signed-in patient gets the same intake back from the API anyway.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN8. The screens that end an intake say why in the protocol's words, and urgent help comes first

Decision: a hard stop shows the protocol's own message for the patient, never the rule the prescriber sees, with the brand's support contact. When the rule asks for urgent help, fixed national wording comes first: "If you're in danger or need urgent help, call 000. To talk to someone now, call Lifeline on 13 11 14, any time.", as phone links. A date of birth under 18 says only that the brand treats adults. Neither screen offers a way to try again, and the reason is never in the page's address or title.
Why: the safety wording is platform copy so no tenant can leave it out (APP12). A retry would teach people to answer until they pass.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN9. A paused brand takes no one new

Decision: when the API says the brand or program isn't accepting new patients, every start page says so with the brand's support contact and a way for existing patients to sign in. An intake already started here gets the same screen, with no promise that its answers are kept.
Why: the API refuses anyway (IDN20); the screen says so before a person starts rather than after.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### JOIN10. Every step saves as it is answered, with no "save and exit"

Decision: each step is saved when the person continues, and the screens say "Your answers are saved as you go, on this device, for 14 days". There is no save-and-exit button, and no resume link by email or text yet.
Why: nothing is lost by leaving, so a button would only suggest otherwise. The line is also the honest notice for a shared device. A resume link (INT-06) is P1 and needs marketing consent first.
Decided by: stand-in (Fable 5.2), to confirm with Vahid
