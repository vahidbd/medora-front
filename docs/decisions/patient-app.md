# The patient app

Rulings for the patient app and portal (PRD section 11) and adherence basics (section 12). ADR 0180 sets how a brand's host becomes its patient app, ADR 0100 how patients sign in; ADRs 0005, 0017, 0022, 0023 and 0026 apply throughout. Rulings marked "Decided by: stand-in" were decided by the product owner's stand-in while the product owner was away, and are listed in the pull request to confirm.

### APP1. Each host serves one surface, and a host that isn't a brand's serves nothing

Decision: the proxy reads the Host header (never a forwarded one). The console's hosts, listed in `CONSOLE_HOSTS`, get the console; any other host is looked up as a brand's patient host and answers 404 when it isn't one, or 503 when the lookup fails. Nothing falls back to the console. Health checks answer on every host.
Why: a default that serves something on an unknown host is how a console ends up on a look-alike domain. Failing closed costs a 503 while the API is down, which the patient app couldn't work without anyway.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP2. The brand reaches the pages from the proxy, and the API's tenant from this server

Decision: the proxy hands the brand it found to the patient pages in request headers it alone writes, dropping any copy a caller sends. On a brand's host the relay names the brand's tenant to the API itself, from the same lookup, and ignores the browser's tenant header. The API's patient routes take the tenant from that header for now (docs/decisions/patients.md IDN4 in medora-backend) and from the brand's host once brands land.
Why: a patient never chooses a tenant; the domain they are on does. Keeping it server-side means no page can name another tenant.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP3. Nothing on a patient page is kept

Decision: patient pages and every relay reply on a brand's host are `Cache-Control: no-store`. Queries are keyed by the brand's host. Signing out, by hand or after 30 idle minutes, cancels and empties the data cache before Clerk's session ends. Nothing goes in browser storage but the theme. No service worker, no browser error tracking (ADR 0026) and no third-party script.
Why: patients use shared and family devices. What a proxy, the back button or an error report keeps is outside the patient's control.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP4. A brand's look is one colour, and only when it reads

Decision: a brand's primary colour replaces the kit's primary (buttons, the current tab) only when white or near-black text on it reaches 4.5:1, which picks the ink; otherwise the kit's primary stays. It is the same in light and dark. Status colours never change. The brand's initial stands in for its logo until logos are served from this app's own origin. The brands screen checks the same rule when the colour is saved.
Why: WCAG 2.2 AA for every brand without a designer checking each one, and no new origin in the security policy for an image.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP5. Patients sign in with an emailed code, on the brand's own screen

Decision: sign-in is two steps on the app's own screens, built on Clerk's hooks: an email, then a six-digit code. An address with no account is signed up by the same two steps. Every failure says the same words whether or not the address has an account. After 30 minutes without activity the app signs the patient out and says why on the sign-in screen; the patient instance's own inactivity timeout is set to match, so the rule holds even with the page closed. Passkeys come later.
Why: one flow to learn, in the brand's look, that never tells anyone which addresses are patients.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP6. The patient app's areas

Decision: Home, Progress, Messages, Care and Account, in that order; at phone width they move to a bar at the bottom. An area, and a card on Home, appears only once the part of Medora behind it exists, so Home says less rather than showing something made up. A medicine on its way is a "shipment", never a "delivery".
Why: the same five places on every brand, and nothing on screen that the platform can't yet back.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP7. What stands between signing in and care

Decision: the signed-in frame waits for the patient's own record (`GET /v1/patient/me`). With no session it goes to sign-in. With a session but no record (`no_patient_record`) it asks the patient to finish setting up, linking to `/start` on a live brand and saying a paused brand takes no new patients; it never sends them back to sign in, which would loop. Before the first page of each new sign-in it asks for the date of birth (`date_of_birth_needed`, ADR 0100); a wrong one says only that it doesn't match. An API that can't be reached says so, with Try again, and never looks like an empty account.
Why: each refusal the API makes has one screen that explains it, and the check lives in the API, so no screen can skip it.

### APP8. A copy of the record and closing the account go through support, for now

Decision: Account says how to ask the brand's support for a copy of the health record or to close the account, and that health records are kept as long as the law requires. Screens for both come with the support and records work.
Why: the Privacy Act gives the patient both rights now; the request and its deadlines belong in the support queue, not in a form that goes nowhere.
Decided by: stand-in (Fable 5.2), to confirm with Vahid

### APP9. A route another part of Medora is still building is copied, and the copy goes when the contract has it

Decision: when the patient app needs a route that isn't in the API's contract yet, its shape is copied by hand in one place, with a note naming the route, and checked where it crosses into the page. The change that picks the route up from the contract deletes the copy. None is left: the public brand route was the first, and its type now comes from the contract; `src/lib/brand.ts` keeps only the check of a brand where it crosses into the page.
Why: the patient app can be built beside the work it depends on without a second, drifting definition of the same shape.
