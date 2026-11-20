/**
 * The mock API's audit log: made-up entries for the demo tenants, read a
 * page at a time and exported, with the API's rules a screen shows
 * (docs/decisions/admin.md ADM25, ADM26 in medora-backend): newest first,
 * an action filter is a prefix, an export is recorded as `audit.exported`
 * and each person may export ten times an hour. Ids and facts only.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import { ME, memberships, TENANTS } from "./people.mjs";
import { tenantOf } from "./staff.mjs";

const [harbour, coastal] = TENANTS.map((t) => t.tenantId);
const ZONES = ["clinical", "operational", "marketing", "platform"];
const FILTERS = ["from", "to", "actorId", "action", "recordTable", "recordId", "zone"];
const EXPORT_MAX = 5000;
const EXPORTS_AN_HOUR = 10;
const HOUR = 60 * 60 * 1000;

let nextEntry = 1;
const entries = [];

function add(tenantId, minutesAgo, actor, action, zone, recordTable, recordId, details = {}) {
  entries.push({
    tenantId,
    entryId: String(nextEntry++),
    at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    actorType: actor === "agent" ? "agent" : actor === "system" ? "system" : "person",
    actorId: actor === "system" ? null : actor === "agent" ? "50000000-0000-4000-8000-000000000001" : actor,
    action,
    zone,
    recordTable,
    recordId,
    requestId: `mock-request-${nextEntry}`,
    details,
  });
}

// Harbour: sixty entries over three weeks, oldest first, so the screen has more than one page.
const harbourStaff = memberships.filter((m) => m.tenantId === harbour && m.status === "active").map((m) => m.userId);
const KINDS = [
  [
    "product.changed",
    "operational",
    "operational.products",
    "70000000-0000-4000-8000-000000000001",
    { changed: "priceCents", priceBefore: 8900, priceAfter: 9200 },
  ],
  [
    "membership.role_changed",
    "platform",
    "platform.memberships",
    "20000000-0000-4000-8000-000000000004",
    { roleBefore: "support", roleAfter: "clinician" },
  ],
  ["brand.changed", "platform", "platform.brands", "40000000-0000-4000-8000-000000000001", { changed: "colour" }],
  ["membership.invited", "platform", "platform.memberships", "20000000-0000-4000-8000-000000000010", { role: "support" }],
  ["product.created", "operational", "operational.products", "70000000-0000-4000-8000-000000000003", {}],
  ["tenant.changed", "platform", "platform.tenants", harbour, { timeZoneBefore: "Australia/Perth", timeZoneAfter: "Australia/Sydney" }],
];
for (let i = 0; i < 60; i += 1) {
  const [action, zone, table, record, details] = KINDS[i % KINDS.length];
  add(harbour, (60 - i) * 480, harbourStaff[i % harbourStaff.length], action, zone, table, record, details);
}
add(harbour, 200, "agent", "product.changed", "operational", "operational.products", "70000000-0000-4000-8000-000000000002", {
  changed: "name",
});
add(harbour, 90, "system", "membership.status_changed", "platform", "platform.memberships", "20000000-0000-4000-8000-000000000006", {
  statusBefore: "active",
  statusAfter: "suspended",
});
add(harbour, 30, ME.userId, "product.blocked", "operational", "operational.products", "70000000-0000-4000-8000-000000000004", {});
add(coastal, 300, ME.userId, "brand.created", "platform", "platform.brands", "40000000-0000-4000-8000-000000000005", {});

const exportsBy = new Map();

function nameOf(entry) {
  if (entry.actorType !== "person") return null;
  const m = memberships.find((x) => x.tenantId === entry.tenantId && x.userId === entry.actorId);
  return m ? (m.displayName ?? m.email) : null;
}

function view(entry) {
  const shown = { ...entry, actorName: nameOf(entry) };
  delete shown.tenantId;
  return shown;
}

/** The filter's fields, or null with a 400 sent: the API refuses fields it doesn't know. */
function filterOf(res, input, extra = []) {
  const unknown = Object.keys(input).filter((key) => !FILTERS.includes(key) && !extra.includes(key));
  const instants = ["from", "to"].every((key) => input[key] === undefined || !Number.isNaN(Date.parse(input[key])));
  if (unknown.length > 0 || !instants || (input.zone !== undefined && !ZONES.includes(input.zone))) {
    fail(res, 400, "bad_request", BAD_REQUEST);
    return null;
  }
  return input;
}

function matching(tenantId, filter) {
  return entries
    .filter(
      (e) =>
        e.tenantId === tenantId &&
        (!filter.from || Date.parse(e.at) >= Date.parse(filter.from)) &&
        (!filter.to || Date.parse(e.at) < Date.parse(filter.to)) &&
        (!filter.actorId || e.actorId === filter.actorId) &&
        (!filter.action || e.action.startsWith(filter.action)) &&
        (!filter.recordTable || e.recordTable === filter.recordTable) &&
        (!filter.recordId || e.recordId === filter.recordId) &&
        (!filter.zone || e.zone === filter.zone),
    )
    .sort((a, b) => Number(b.entryId) - Number(a.entryId));
}

function page(req, res) {
  const mine = tenantOf(req, res, "audit:read");
  if (!mine) return;
  const query = Object.fromEntries(new URL(req.url, "http://mock").searchParams);
  const filter = filterOf(res, query, ["before", "limit"]);
  if (!filter) return;
  const limit = filter.limit === undefined ? 50 : Number(filter.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(res, 400, "bad_request", BAD_REQUEST);
  const found = matching(mine.tenantId, filter).filter((e) => !filter.before || Number(e.entryId) < Number(filter.before));
  const shown = found.slice(0, limit);
  send(res, 200, { entries: shown.map(view), nextBefore: found.length > limit ? shown[shown.length - 1].entryId : null });
}

async function exportLog(req, res) {
  const mine = tenantOf(req, res, "audit:read");
  if (!mine) return;
  const key = `${mine.tenantId}:${mine.userId}`;
  const recent = (exportsBy.get(key) ?? []).filter((at) => at > Date.now() - HOUR);
  recent.push(Date.now());
  exportsBy.set(key, recent);
  if (recent.length > EXPORTS_AN_HOUR) {
    const retryAfter = Math.ceil((recent[0] + HOUR - Date.now()) / 1000);
    return send(
      res,
      429,
      { error: { code: "too_many_requests", message: "Too many attempts. Wait a moment and try again." } },
      { "retry-after": String(retryAfter) },
    );
  }
  const input = await readJson(req);
  if (!isObject(input)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const filter = filterOf(res, input);
  if (!filter) return;
  const found = matching(mine.tenantId, filter);
  const shown = found.slice(0, EXPORT_MAX);
  add(mine.tenantId, 0, mine.userId, "audit.exported", "platform", "platform.audit_log", mine.tenantId, {
    newestEntryId: shown[0]?.entryId ?? null,
    count: shown.length,
    truncated: found.length > EXPORT_MAX,
  });
  send(res, 200, { entries: shown.map(view), truncated: found.length > EXPORT_MAX });
}

export const auditRoutes = [
  ["GET", /^\/v1\/audit$/, page],
  ["POST", /^\/v1\/audit\/exports$/, exportLog],
];
