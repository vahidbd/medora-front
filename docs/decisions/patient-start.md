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
