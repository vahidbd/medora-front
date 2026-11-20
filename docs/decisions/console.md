# Staff console

Rulings for the staff console's foundation: the sign-in gate, the tenant switch, the shell, page security and preview mode (ADRs 0011, 0018, 0024, 0026, 0030 set the rules; the API's side is in `medora-backend`'s `docs/decisions/foundation.md`).

### CON1. Sign-in is by invitation only

Decision: the sign-in page offers no sign-up. A sign-in the API has no account for (`no_account`) gets a gate that says nobody has invited that address and to ask an owner, with Sign out; it is never sent back to sign in again. A person whose access is paused in every tenant gets "Your access is paused". Any other 401 means the session is gone and goes to `/sign-in?next=<the page>`; `next` is only followed when it is a path on this app.
Why: staff are invited before they sign in (FND2). A loop back to sign-in would hide why someone can't get in, and an open `next` would let a link send a person anywhere after signing in.

### CON2. The tenant being worked in is chosen in the brand row and remembered per browser

Decision: the brand row shows the tenant; with more than one active membership it opens "Work in". The choice is kept in `localStorage` as `medora:tenant` (a tenant id, nothing else), and falls back to the first active membership when it is missing or no longer valid. Every call that acts in a tenant sends it in `x-medora-tenant`. Switching drops everything loaded except who the person is.
Why: the API needs the tenant on every call (FND1). Dropping the old tenant's data means a screen can never show one tenant's records under another's name, even for a moment.

### CON3. Screens show only what the person's role can use, and the API still decides

Decision: `GET /v1/me` lists each membership's permissions. The sidebar, ⌘K and actions check `can(permission)` against the current tenant's list (`config/navigation.ts`, `useCanSee`). The web app keeps no copy of the role table.
Why: one source for who may do what, in the API (ADR 0030). A screen that hides a button is a courtesy; the refusal is the API's.

### CON4. Staff is read-only until changing access has its own screen

Decision: the Staff screen lists each staff member's email, role and access (Active or Paused). Changing a role or pausing access arrives as its own change, built on the API's `PATCH /v1/staff/:membershipId` and its rules (FND6).
Why: the first screen proves the path from sign-in to a tenant's data; changing access needs its own confirmation and copy.

### CON5. Every page gets its own script nonce, so every page renders per request

Decision: `src/proxy.ts` builds the content security policy for each request with a fresh nonce: scripts only from this origin and only with that nonce (`'strict-dynamic'` lets them load what they need), no framing, connections only to this app, Clerk and the error tracker. The root layout reads the nonce, so no page is prerendered.
Why: ADR 0030. A static page can't carry a per-request nonce, and the console has no page worth caching: every screen depends on who is signed in.

### CON6. Two health addresses: one for uptime, one for deploys

Decision: `/api/health` answers 200 only when this app, the API and its database all answer, and names the part that is down; the uptime check watches it. `/api/health/live` answers for this app alone, with the release commit; the host's deploy check (`railway.json`) uses it. Neither needs a session.
Why: one uptime check covers the whole path a person uses (ADR 0024), but a web release must still be able to go out while the API is down.

### CON7. Preview mode runs every screen without keys, and never runs hosted

Decision: `npm run dev:preview` swaps Clerk for stubs that sign everyone in as a made-up owner and points the app at a local mock API with made-up tenants and staff (`dev/`). It builds into its own folder, and the build fails when it sees a hosted environment. The browser tests run against it.
Why: screens can be checked, and tested in CI, without Clerk keys, the API or any real data, and a stubbed sign-in can never ship.

### CON8. Staging and production refuse to start with unsafe settings

Decision: at boot, a deployed web app checks that the API's address is https, the Clerk keys are production keys in production, the client-address secret is set, the release commit is known and preview mode is off. It stops with the list of what is wrong (`src/lib/server/deployed-settings.ts`), so the running release stays up.
Why: ADR 0025, the web app's half of it.
