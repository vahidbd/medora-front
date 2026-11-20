#!/usr/bin/env node
/**
 * Preview-mode stand-in for the Medora API: the few routes the web app
 * calls today, with made-up tenants and staff, held in memory and reset
 * on every start. No dependencies, so it runs anywhere Node does.
 *
 * It answers the way the API does (contract/openapi.json in the backend):
 * the same shapes, the same error envelope, the tenant in the
 * x-medora-tenant header. It does not check tokens; preview mode has no
 * real sign-in. Add a route here when a screen starts calling one.
 *
 * Env: MOCK_API_PORT (default 4010).
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_API_PORT || 4010);
const TENANT_HEADER = "x-medora-tenant";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLES = ["owner", "clinician", "support", "finance"];
const STATUSES = ["active", "suspended"];
const ROLE_PERMISSIONS = {
  owner: ["staff:read", "staff:manage"],
  clinician: ["staff:read"],
  support: ["staff:read"],
  finance: ["staff:read"],
};

// The preview person. The mock Clerk session (dev/mock-clerk) is the same person.
const ME = { userId: "00000000-0000-4000-8000-000000000001", email: "owner@example.test" };

const TENANTS = [
  { tenantId: "10000000-0000-4000-8000-000000000001", tenantName: "Harbour Health (demo)" },
  { tenantId: "10000000-0000-4000-8000-000000000002", tenantName: "Coastal Skin (demo)" },
];

let next = 1;
function member(tenantId, userId, email, role, status = "active") {
  const membershipId = `20000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  return { membershipId, tenantId, userId, email, role, status };
}
function person(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const [harbour, coastal] = TENANTS.map((t) => t.tenantId);
const memberships = [
  member(harbour, ME.userId, ME.email, "owner"),
  member(harbour, person(2), "sam.lee@example.test", "clinician"),
  member(harbour, person(3), "jordan.patel@example.test", "clinician"),
  member(harbour, person(4), "riley.chen@example.test", "support"),
  member(harbour, person(5), "casey.nguyen@example.test", "finance"),
  member(harbour, person(6), "drew.walker@example.test", "support", "suspended"),
  member(coastal, ME.userId, ME.email, "clinician"),
  member(coastal, person(7), "morgan.brooks@example.test", "owner"),
  member(coastal, person(8), "taylor.reid@example.test", "clinician"),
];

const staffMember = ({ membershipId, userId, email, role, status }) => ({ membershipId, userId, email, role, status });

function send(res, status, body, headers = {}) {
  const text = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  res.end(text);
}

function fail(res, status, code, message, details) {
  send(res, status, { error: { code, message, ...(details === undefined ? {} : { details }) } });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return Symbol.for("bad-json");
  }
}

/** The caller's membership in the tenant the header names, or a reply already sent. */
function tenantOf(req, res) {
  const tenantId = req.headers[TENANT_HEADER];
  if (tenantId === undefined) {
    fail(res, 400, "tenant_required", `Choose a tenant first (${TENANT_HEADER})`);
    return null;
  }
  if (typeof tenantId !== "string" || !UUID.test(tenantId)) {
    fail(res, 400, "bad_request", `${TENANT_HEADER} must be a tenant id`);
    return null;
  }
  const mine = memberships.find((m) => m.tenantId === tenantId.toLowerCase() && m.userId === ME.userId && m.status === "active");
  if (!mine) {
    fail(res, 403, "not_a_member", "You aren't a member of that tenant");
    return null;
  }
  return mine;
}

function requirePermission(res, mine, permission) {
  if (ROLE_PERMISSIONS[mine.role].includes(permission)) return true;
  fail(res, 403, "forbidden", "You don't have permission to do that");
  return false;
}

const routes = [
  ["GET", /^\/health$/, (req, res) => send(res, 200, { status: "ok", service: "medora-api", version: "mock" })],
  [
    "GET",
    /^\/health\/ready$/,
    (req, res) => send(res, 200, { status: "ok", service: "medora-api", version: "mock", database: "ok" }),
  ],
  [
    "GET",
    /^\/v1\/me$/,
    (req, res) =>
      send(res, 200, {
        ...ME,
        memberships: memberships
          .filter((m) => m.userId === ME.userId)
          .map((m) => ({
            membershipId: m.membershipId,
            tenantId: m.tenantId,
            tenantName: TENANTS.find((t) => t.tenantId === m.tenantId).tenantName,
            role: m.role,
            status: m.status,
            permissions: [...ROLE_PERMISSIONS[m.role]],
          })),
      }),
  ],
  [
    "GET",
    /^\/v1\/staff$/,
    (req, res) => {
      const mine = tenantOf(req, res);
      if (!mine || !requirePermission(res, mine, "staff:read")) return;
      send(res, 200, { staff: memberships.filter((m) => m.tenantId === mine.tenantId).map(staffMember) });
    },
  ],
  [
    "PATCH",
    /^\/v1\/staff\/([^/]+)$/,
    async (req, res, [membershipId]) => {
      const mine = tenantOf(req, res);
      if (!mine || !requirePermission(res, mine, "staff:manage")) return;
      const body = await readJson(req);
      const valid =
        body &&
        typeof body === "object" &&
        Object.keys(body).every((k) => k === "role" || k === "status") &&
        (body.role !== undefined || body.status !== undefined) &&
        (body.role === undefined || ROLES.includes(body.role)) &&
        (body.status === undefined || STATUSES.includes(body.status));
      if (!valid) return fail(res, 400, "bad_request", "Some of what was sent is missing or not in the right form");
      const target = memberships.find((m) => m.tenantId === mine.tenantId && m.membershipId === membershipId);
      if (!target) return fail(res, 404, "not_found", "Staff member not found");
      if (target.userId === ME.userId) return fail(res, 403, "own_membership", "You can't change your own role or access. Ask another owner.");
      const role = body.role ?? target.role;
      const status = body.status ?? target.status;
      const losesOwner = target.role === "owner" && target.status === "active" && (role !== "owner" || status !== "active");
      const activeOwners = memberships.filter((m) => m.tenantId === mine.tenantId && m.role === "owner" && m.status === "active");
      if (losesOwner && activeOwners.length <= 1) return fail(res, 409, "last_owner", "Every tenant needs at least one active owner");
      Object.assign(target, { role, status });
      send(res, 200, staffMember(target));
    },
  ],
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
    await route[2](req, res, pathname.match(route[1]).slice(1));
  } catch {
    if (!res.headersSent) fail(res, 500, "internal_error", "The mock API failed");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`[mock-api] listening on http://127.0.0.1:${PORT}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
