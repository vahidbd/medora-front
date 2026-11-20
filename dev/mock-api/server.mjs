#!/usr/bin/env node
/**
 * Preview-mode stand-in for the Medora API: the routes the web app calls
 * today, with made-up tenants and staff (people.mjs), held in memory and
 * reset on every start. No dependencies, so it runs anywhere Node does.
 * Each area's routes live in their own file: staff.mjs, tenant-setup.mjs,
 * catalogue.mjs, audit.mjs, patient.mjs for the brands and the patient's own
 * routes, and tracking.mjs for what patients record.
 *
 * It answers the way the API does (contract/openapi.json in the backend):
 * the same shapes, the same error envelope, the tenant in the
 * x-medora-tenant header. It does not check tokens; preview mode has no
 * real sign-in. Add a route here when a screen starts calling one.
 *
 * Env: MOCK_API_PORT (default 4010).
 */
import { createServer } from "node:http";
import { auditRoutes } from "./audit.mjs";
import { catalogueRoutes } from "./catalogue.mjs";
import { fail, readJson, send } from "./http.mjs";
import { patientRoutes } from "./patient.mjs";
import { staffRoutes } from "./staff.mjs";
import { trackingRoutes } from "./tracking.mjs";
import { tenantSetupRoutes } from "./tenant-setup.mjs";

const PORT = Number(process.env.MOCK_API_PORT || 4010);

const routes = [
  ["GET", /^\/health$/, (req, res) => send(res, 200, { status: "ok", service: "medora-api", version: "mock" })],
  [
    "GET",
    /^\/health\/ready$/,
    (req, res) => send(res, 200, { status: "ok", service: "medora-api", version: "mock", database: "ok" }),
  ],
  ...staffRoutes,
  ...patientRoutes({ send, fail, readJson }),
  ...trackingRoutes({ send, fail, readJson }),
  ...tenantSetupRoutes,
  ...catalogueRoutes,
  ...auditRoutes,
];

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://mock");
  const pathMatches = routes.filter(([, pattern]) => pattern.test(pathname));
  const route = pathMatches.find(([method]) => method === req.method);
  if (!route) {
    if (pathMatches.length > 0) return fail(res, 405, "method_not_allowed", "Method not allowed");
    return fail(res, 404, "not_found", "Route not found");
  }
  try {
    await route[2](req, res, pathname.match(route[1]).slice(1), req.method, pathname);
  } catch {
    if (!res.headersSent) fail(res, 500, "internal_error", "The mock API failed");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`[mock-api] listening on http://127.0.0.1:${PORT}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
