/**
 * The mock API's catalogue routes: a tenant's products and Medora's block
 * rules, with the API's rules where a screen shows their refusals
 * (medicine_identity_required, not_a_medicine, artg_invalid, rule_exists,
 * rule_value_invalid). Whether a product is blocked is worked out on every
 * read, as the API does (docs/decisions/catalogue.md CAT3). Made-up
 * products, ARTG numbers and rules only.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import { daysFromNow, ME, newId, TENANTS } from "./people.mjs";
import { tenantOf } from "./staff.mjs";

const [harbour, coastal] = TENANTS.map((t) => t.tenantId);
const KINDS = ["medicine", "device", "service"];
const SCHEDULES = ["S2", "S3", "S4", "S8"];
const STORAGE = ["room", "refrigerated"];
const MATCHES = ["schedule", "artg_number", "compounded"];

function productRow(n, tenantId, name, extra) {
  return {
    productId: `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    tenantId,
    name,
    kind: "medicine",
    schedule: "S4",
    artgNumber: null,
    compounded: false,
    strength: null,
    form: null,
    packSize: null,
    storage: "room",
    priceCents: 0,
    gstFree: true,
    status: "active",
    blockedReason: null,
    updatedAt: daysFromNow(-10),
    ...extra,
  };
}

const products = [
  productRow(1, harbour, "Harbour weight tablets", {
    artgNumber: "300001",
    strength: "10 mg",
    form: "Tablet",
    packSize: "30",
    priceCents: 8900,
  }),
  productRow(2, harbour, "Harbour weekly pen", {
    artgNumber: "300002",
    strength: "0.5 mg",
    form: "Pen",
    packSize: "4",
    storage: "refrigerated",
    priceCents: 24900,
  }),
  productRow(3, harbour, "Harbour compounded cream", { compounded: true, strength: "2%", form: "Cream", priceCents: 5900 }),
  productRow(4, harbour, "Harbour sleep tablets", {
    artgNumber: "300004",
    strength: "5 mg",
    form: "Tablet",
    packSize: "28",
    priceCents: 4500,
    blockedReason: "Supplier recall (made-up)",
  }),
  productRow(5, harbour, "Body composition scale", { kind: "device", schedule: null, priceCents: 12900, gstFree: false }),
  productRow(6, harbour, "Sleep coaching session", {
    kind: "service",
    schedule: null,
    priceCents: 9900,
    gstFree: false,
    status: "archived",
  }),
  productRow(7, coastal, "Coastal skin cream", { artgNumber: "300010", strength: "0.05%", form: "Cream", priceCents: 6900 }),
];

const rules = [
  {
    ruleId: "71000000-0000-4000-8000-000000000001",
    match: "compounded",
    value: null,
    reason: "Preview rule: compounded medicines aren't sold through Medora.",
    sourceUrl: null,
    effectiveFrom: daysFromNow(-60),
    addedAt: daysFromNow(-60),
  },
  {
    ruleId: "71000000-0000-4000-8000-000000000002",
    match: "schedule",
    value: "S8",
    reason: "Preview rule: Schedule 8 medicines aren't sold through Medora.",
    sourceUrl: "https://example.test/notice",
    effectiveFrom: daysFromNow(-60),
    addedAt: daysFromNow(-60),
  },
];

const matches = (rule, p) =>
  rule.match === "schedule" ? p.schedule === rule.value : rule.match === "artg_number" ? p.artgNumber === rule.value : p.compounded;

function blockOf(p) {
  const now = new Date();
  const rule = rules.find((r) => new Date(r.effectiveFrom) <= now && matches(r, p));
  if (rule) return { code: "platform_rule", reason: rule.reason, ruleId: rule.ruleId };
  return p.blockedReason ? { code: "tenant_block", reason: p.blockedReason, ruleId: null } : null;
}

function productOf(p) {
  const reply = { ...p, blocked: blockOf(p) };
  delete reply.tenantId;
  delete reply.blockedReason;
  return reply;
}

async function body(req, res, keys) {
  const value = await readJson(req);
  if (!isObject(value) || !Object.keys(value).every((k) => keys.includes(k))) return (fail(res, 400, "bad_request", BAD_REQUEST), null);
  return value;
}

const artgOf = (typed) => {
  if (typed === null || typed === undefined) return null;
  const digits = String(typed)
    .replace(/^\s*ARTG\s*/i, "")
    .replace(/[\s-]/g, "");
  return digits === "" ? null : digits;
};

const FIELDS = ["name", "kind", "schedule", "artgNumber", "compounded", "strength", "form", "packSize", "storage", "priceCents", "gstFree"];

/** CAT1, as the API checks it. Answers the fields to save, or null after failing the reply. */
function productFields(res, input, before) {
  const pick = (key, fallback) => (input[key] === undefined ? (before ? before[key] : fallback) : input[key]);
  const fields = {
    name: String(pick("name", "")).trim(),
    kind: pick("kind", "medicine"),
    schedule: pick("schedule", null),
    artgNumber: input.artgNumber === undefined ? (before?.artgNumber ?? null) : artgOf(input.artgNumber),
    compounded: pick("compounded", false) === true,
    strength: pick("strength", null),
    form: pick("form", null),
    packSize: pick("packSize", null),
    storage: pick("storage", "room"),
    priceCents: pick("priceCents", undefined),
    gstFree: pick("gstFree", undefined),
  };
  const valid =
    fields.name.length > 0 &&
    KINDS.includes(fields.kind) &&
    (fields.schedule === null || SCHEDULES.includes(fields.schedule)) &&
    STORAGE.includes(fields.storage) &&
    Number.isInteger(fields.priceCents) &&
    fields.priceCents >= 0 &&
    typeof fields.gstFree === "boolean";
  if (!valid) return (fail(res, 400, "bad_request", BAD_REQUEST), null);
  if (fields.artgNumber !== null && !/^[0-9]{3,8}$/.test(fields.artgNumber))
    return (fail(res, 400, "artg_invalid", "An ARTG number is 3 to 8 digits"), null);
  if (fields.kind === "medicine" && fields.artgNumber === null && !fields.compounded)
    return (fail(res, 400, "medicine_identity_required", "A medicine needs its ARTG number, or to be marked compounded"), null);
  if (fields.kind !== "medicine" && (fields.schedule !== null || fields.compounded))
    return (fail(res, 400, "not_a_medicine", "Only a medicine has a schedule or is compounded"), null);
  return fields;
}

const findProduct = (mine, id) => products.find((p) => p.tenantId === mine.tenantId && p.productId === id);

function listProducts(req, res) {
  const mine = tenantOf(req, res, "catalogue:read");
  if (mine) send(res, 200, { products: products.filter((p) => p.tenantId === mine.tenantId).map(productOf) });
}

async function createProduct(req, res) {
  const mine = tenantOf(req, res, "catalogue:manage");
  if (!mine) return;
  const input = await body(req, res, FIELDS);
  if (!input) return;
  const fields = productFields(res, input, null);
  if (!fields) return;
  const product = {
    productId: newId("70000000"),
    tenantId: mine.tenantId,
    ...fields,
    status: "active",
    blockedReason: null,
    updatedAt: new Date().toISOString(),
  };
  products.push(product);
  send(res, 201, productOf(product));
}

async function product(req, res, [id], method) {
  const mine = tenantOf(req, res, method === "GET" ? "catalogue:read" : "catalogue:manage");
  if (!mine) return;
  const found = findProduct(mine, id);
  if (!found) return fail(res, 404, "not_found", "Product not found");
  if (method === "GET") return send(res, 200, productOf(found));
  const input = await body(req, res, FIELDS);
  if (!input) return;
  const fields = productFields(res, input, found);
  if (!fields) return;
  Object.assign(found, fields, { updatedAt: new Date().toISOString() });
  send(res, 200, productOf(found));
}

async function productStatus(req, res, [id]) {
  const mine = tenantOf(req, res, "catalogue:manage");
  if (!mine) return;
  const found = findProduct(mine, id);
  if (!found) return fail(res, 404, "not_found", "Product not found");
  const input = await body(req, res, ["status"]);
  if (!input) return;
  if (!["active", "archived"].includes(input.status)) return fail(res, 400, "bad_request", BAD_REQUEST);
  Object.assign(found, { status: input.status, updatedAt: new Date().toISOString() });
  send(res, 200, productOf(found));
}

async function productBlock(req, res, [id], method) {
  const mine = tenantOf(req, res, "catalogue:manage");
  if (!mine) return;
  const found = findProduct(mine, id);
  if (!found) return fail(res, 404, "not_found", "Product not found");
  if (method === "DELETE") {
    found.blockedReason = null;
    return send(res, 200, productOf(found));
  }
  const input = await body(req, res, ["reason"]);
  if (!input) return;
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 3 || reason.length > 300) return fail(res, 400, "bad_request", BAD_REQUEST);
  found.blockedReason = reason;
  send(res, 200, productOf(found));
}

// Medora's block rules (CAT2): everyone signed in reads them, platform staff add them.

function listRules(req, res) {
  send(res, 200, { rules });
}

async function addRule(req, res) {
  if (!ME.platformStaff) return fail(res, 403, "forbidden", "You don't have permission to do that");
  const input = await body(req, res, ["match", "value", "reason", "sourceUrl", "effectiveFrom"]);
  if (!input) return;
  const reason = String(input.reason ?? "").trim();
  if (!MATCHES.includes(input.match) || reason.length < 10 || reason.length > 500) return fail(res, 400, "bad_request", BAD_REQUEST);
  let value = null;
  if (input.match === "schedule") {
    value = String(input.value ?? "").toUpperCase();
    if (!SCHEDULES.includes(value)) return fail(res, 400, "rule_value_invalid", "Choose a schedule: S2, S3, S4 or S8");
  } else if (input.match === "artg_number") {
    value = artgOf(input.value);
    if (!value || !/^[0-9]{3,8}$/.test(value)) return fail(res, 400, "rule_value_invalid", "An ARTG number is 3 to 8 digits");
  }
  if (rules.some((r) => r.match === input.match && r.value === value)) return fail(res, 409, "rule_exists", "Medora already blocks that");
  const now = new Date().toISOString();
  const rule = {
    ruleId: newId("71000000"),
    match: input.match,
    value,
    reason,
    sourceUrl: input.sourceUrl ?? null,
    effectiveFrom: input.effectiveFrom ?? now,
    addedAt: now,
  };
  rules.push(rule);
  send(res, 201, rule);
}

export const catalogueRoutes = [
  ["GET", /^\/v1\/products$/, listProducts],
  ["POST", /^\/v1\/products$/, createProduct],
  ["GET", /^\/v1\/products\/([^/]+)$/, product],
  ["PATCH", /^\/v1\/products\/([^/]+)$/, product],
  ["POST", /^\/v1\/products\/([^/]+)\/status$/, productStatus],
  ["POST", /^\/v1\/products\/([^/]+)\/block$/, productBlock],
  ["DELETE", /^\/v1\/products\/([^/]+)\/block$/, productBlock],
  ["GET", /^\/v1\/block-rules$/, listRules],
  ["POST", /^\/v1\/platform\/block-rules$/, addRule],
];
