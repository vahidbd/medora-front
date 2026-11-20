# Preview mode

Every screen, without Clerk keys, without the API and without any real data.

```bash
npm run dev:preview      # next dev on http://localhost:3000, with the mock API on 127.0.0.1:4010
npm run build:preview    # a production build of the same, into .next/preview
npm run start:preview    # serve that build, with the mock API
npm run test:e2e         # the browser tests, against start:preview (build first)
```

`MEDORA_PREVIEW=1` (set by `dev/preview.mjs`) makes `next.config.ts` swap `@clerk/nextjs` and `@clerk/nextjs/server` for the stand-ins in `mock-clerk/`: everyone is signed in as Alex Morgan, `owner@example.test`. `BACKEND_URL` points at the mock API in `mock-api/server.mjs`, which answers in the API's own shapes and error envelope:

| Route | Answer |
| --- | --- |
| `GET /health`, `GET /health/ready` | ok |
| `GET /v1/me`, `GET /v1/me/sign-ins` | the preview person: owner of Harbour Health (demo), clinician at Coastal Skin (demo), always with a second factor |
| `GET /v1/staff`, `PATCH /v1/staff/:membershipId` | the tenant's made-up staff; changes with the API's rules (`own_membership`, `last_owner`, `cannot_grant`) |
| `POST /v1/staff/invitations`, `POST` and `DELETE /v1/staff/:membershipId/invitation`, `GET /v1/staff/:membershipId/sign-ins` | invitations (always "sent") and sign-in history |
| `GET`, `POST /v1/roles`, `PATCH` and `DELETE /v1/roles/:roleId` | starting roles and custom roles (`role_name_taken`, `own_role`, `role_in_use`) |
| `POST /v1/break-glass`, `POST /v1/break-glass/close`, `GET /v1/break-glass`, `POST /v1/break-glass/:id/review` | break-glass and its reviews |

The data is in `mock-api/people.mjs` and the routes in one file per area (`mock-api/staff.mjs`). One deliberate difference: no clinical permission exists yet, so the real API offers break-glass to nobody, but the mock offers it to Harbour's owner so its screens can be seen and tested.

The mock keeps changes in memory until it stops. When a screen starts calling a new route, add it here in the API's shape (its contract is `medora-backend/contract/openapi.json`), with made-up data only.

To run the console against a real local API instead, keep Clerk stubbed and pass a token from the API's `npm run dev:token`:

```bash
PREVIEW_BACKEND_URL=http://localhost:4000 PREVIEW_BACKEND_TOKEN=<token> npm run dev:preview
```

Preview mode never runs hosted: the build fails when it sees `RAILWAY_ENVIRONMENT`, `CI_DEPLOY` or a staging or production `MEDORA_ENV` (CON7).
