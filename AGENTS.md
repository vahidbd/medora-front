# Medora web app

Medora is a multi-tenant telehealth operating platform for Australia. Tenants (clinics and operators) run their whole care operation on it: brand sites, intake, consults, prescribing through Parchment, orders, billing, support, CRM and AI agents. This repo is the web app: the staff console today, and the patient app and brand sites as they arrive. Next.js 16 (App Router), React 19, Tailwind 4 with the Grid UI kit, TanStack Query and Clerk. The API is `medora-backend`.

## What we never compromise on

These come from the PRD's design principles. If a rule here fights the task you were given, stop and ask the person who gave it to you.

1. **Compliance is enforced by the system, never only by a screen.** Hiding a button is a courtesy; the API decides what may happen and refuses the rest (ADR 0009). A screen never works around a refusal.
2. **Clinical and marketing data are kept apart.** Brand sites and anything marketing-facing never call a clinical endpoint, and carry no tracking scripts on a page that shows health data (ADRs 0007, 0018, 0022).
3. **Every patient touch is logged**, by the API. The web app never reads clinical data any way but through the API.
4. **One core, many brands.** Conditions, protocols, brands, prices and brand copy are tenant data, never code (ADR 0023).
5. **Tenants are isolated.** Every call that acts in a tenant names it, and everything loaded for one tenant is dropped when the staff member switches (ADR 0006).
6. **Patient data stays in Australia** (ADR 0005), and out of the browser's storage, URLs and error reports.

## A note from the product owner

This is the biggest platform we will run, and it holds people's health. I want simple systems that make the right behaviour unsurprising: the smallest model that fits the real constraint, no machinery because it looks impressive, nothing kept just because it exists. Build the core properly before building wide. When you are unsure, ask; a question costs minutes, a wrong guess in clinical or money code costs far more.

## Words

Read [GLOSSARY.md](GLOSSARY.md) before naming anything. One word per thing, the same in screens, routes, code and the API's fields. "You" is the coding agent; "agent" is one of Medora's own AI agents. How things look is in [DESIGN.md](DESIGN.md).

## The ways to hurt yourself

1. **Patient data where it doesn't belong.** Never put patient details (names, contact details, dates of birth, Medicare numbers, intake answers, notes) in a URL, `localStorage`, a console line, an error report, a toast that outlives its screen, a test fixture, a commit message, pull request text or a model prompt without masking. Fixtures and the mock API use made-up people.
2. **The browser talking to the API.** The browser calls this app's own `/api/backend/*` and nothing else; the server attaches the session token (`src/lib/server/relay.ts`). Never send a token to the browser, call the API's address from client code, or import `@/lib/server/*` outside route handlers, the proxy and server modules (lint refuses it).
3. **A rule that lives only in a screen.** A permission check, a compliance gate or a limit that exists only in the UI is not a rule. Put it in the API, then reflect it here.
4. **Production in development.** Never put a production key, connection string or deploy token in `.env.local`, a shell, a test or a cloud coding session. Preview mode stubs out sign-in and refuses to build on a hosted service (`next.config.ts`); don't work around it.
5. **Weakening the page's defences.** Every page carries a nonce-based content security policy (`src/proxy.ts`). No inline script, no `dangerouslySetInnerHTML` (lint refuses it), no third-party script, and no new origin in the policy without an ADR.
6. **Editing history.** Never edit an accepted ADR. Add a new one.

## Hit every surface

The most common defect is a change that works on the path you tested and is missing everywhere else. Before calling work done, say in the pull request which of these applied:

- **Tenant and brand**: the call names its tenant; the query key includes the tenant id; brand-specific copy comes from configuration.
- **Role and permission**: the navigation entry and every action check `can(permission)`; the API still refuses on its own (ADR 0030).
- **Contract**: types come from the API's contract (`npm run contract`, ADR 0014); no hand-written copy of an API shape.
- **States**: loading, empty and failed to load are three different screens, and a failed read never looks empty (ADR 0031).
- **Copy**: glossary words, sentence case, no em dash, Australian formats through `src/lib/format.ts`.
- **Design**: [DESIGN.md](DESIGN.md), light and dark, and phone width.
- **Keyboard and screen reader**: every control reachable and named; focus moves for the keyboard only.
- **Time**: whose time zone "today" is in (ADR 0017).
- **The way back out**: pause needs resume, cancel needs reinstate, a flag needs its off state tested.
- **Docs**: a ruling in `docs/decisions/`, and an ADR if the change is system-level (ADR 0001).

## Running it

```bash
npm ci
npm run dev:preview     # every screen against a local mock API, signed in as a made-up owner: no keys, no API
```

Against the real API (`medora-backend` running on http://localhost:4000, with its database seeded):

```bash
cp .env.example .env.local   # then add a Clerk development instance's keys (pk_test_ / sk_test_)
npm run dev                  # http://localhost:3000
```

Seed data and the mock are synthetic: made-up tenants and staff. Never copy production data into development, not even de-identified.

## Verifying

```bash
npm run typecheck
npm run lint
npm test                                   # unit tests (Vitest), test/unit
npm run check                              # blocked names, file names, skills, ADR and glossary copies, contract types
npm run build                              # the production build; it type-checks and fails on any error
npm run build:preview && npm run test:e2e  # every screen in a browser (Playwright), against the mock API
```

- Unit tests cover functions with rules that can break: the relay, the security policy, signing, settings checks. Screens are covered in the browser tests.
- A new screen gets a browser test in `test/e2e/`, and the mock API (`dev/mock-api/server.mjs`) learns the routes it calls, in the API's own shapes.
- A bug fix starts with a failing test at the lowest layer that shows it.
- No sleeps, retries or wall-clock waits in tests; wait for what the page shows.
- Tests must assert (`requireAssertions` is on).

## Pull requests

- One feature or one fix per pull request, under about 1,500 changed lines (ADR 0034).
- Use the template in `.github/pull_request_template.md`. Name the ADRs and rulings the change follows, fill in "Merge danger", and list the surfaces from "Hit every surface". Add screenshots of every changed screen, light and dark.
- Changes to sign-in, the relay, security headers, error tracking, permissions, AI autonomy or delivery need the product owner's review (`.github/CODEOWNERS`).
- Never weaken a check to get CI green: no skipped tests, no lint suppressions, no baseline files.

## Documentation

- `docs/adr/`: system-level decisions, byte-for-byte the same files as in `medora-backend` (CI checks). Read the ones in the area you touch before you start. Write one in both repos when your change is system-level (`write-adr` skill).
- `docs/decisions/<feature>.md`: why a feature or screen works the way it does. New rulings go in the same pull request as the code.
- `GLOSSARY.md`: the same file in both repos.
- Outside services and what reaches them: `docs/providers.md` in `medora-backend`. A new one in the web app (a script, a font host, an analytics tool) goes there first, with an ADR.
- Never commit plans, scratch notes or session transcripts.

## Where code lives

```
src/
├── proxy.ts                 # every request: Clerk, and the per-request content security policy
├── instrumentation.ts       # boot: refuses unsafe deployed settings; server error tracking
├── app/
│   ├── layout.tsx           # fonts, theme, the nonce
│   ├── (app)/               # the staff console: sign-in gate, tenant, shell, then one folder per screen
│   ├── sign-in/             # Clerk's sign-in, invitation only
│   └── api/
│       ├── backend/         # the relay to the API: /api/backend/<path> → API /v1/<path>
│       └── health/          # /api/health (uptime: app, API, database) and /api/health/live (deploys)
├── components/
│   ├── ui/                  # the kit's primitives (shadcn on Base UI, owned here)
│   ├── shared/              # page header, empty and failed states, status badge, avatar
│   └── shell/               # sidebar, tenant switch, command bar, sign-in gate
├── config/navigation.ts     # the sidebar and ⌘K: every screen, with the permission it needs
├── lib/
│   ├── api/                 # the browser's client, and the API's types from its contract (schema.d.ts is generated)
│   ├── server/              # server only: relay, token, client address, security policy, settings checks
│   ├── error-tracking/      # scrubbed error reports (ADR 0026)
│   ├── format.ts            # Australian formats
│   └── roles.ts             # labels for roles, statuses and permissions
└── styles/                  # the Grid UI kit and Medora's additions (DESIGN.md)
dev/                         # preview mode: the mock API and the stand-in for Clerk (dev/README.md)
test/unit/, test/e2e/        # Vitest and Playwright
scripts/                     # repo checks and contract types
```

- Server components by default; `"use client"` on the smallest piece that needs state, effects or the browser.
- Data in client components comes through TanStack Query, keyed by tenant: `["staff", tenantId]`.
- Keep files under 400 lines.
- Next 16 differs from older versions: middleware is `src/proxy.ts`, and `params`, `searchParams`, `headers()` and `cookies()` are async. Read the guide in `node_modules/next/dist/docs/` before using an API you are unsure of.

## Skills

Skills live in `.agents/skills/` and are mirrored to `.claude/skills/` (CI checks the copies match). Grill before building (`grill-with-docs`), test first (`tdd`), diagnose before fixing (`diagnosing-bugs`), review before opening a pull request (`review-change`), and record decisions with `write-adr`.
