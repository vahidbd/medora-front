/**
 * The mock API's agent routes (docs/decisions/agents.md): settings and the
 * tenant pause, runs, transcripts and proposals, with the API's refusals
 * where a screen shows them (eval_required, spend_cap_required,
 * tool_ceiling, proposal_*). Every conversation and person here is made
 * up, and transcripts are already masked, as the API stores them.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import { daysFromNow, newId, TENANTS } from "./people.mjs";
import { tenantOf, usablePermissionsOf } from "./staff.mjs";

const [harbour, , northside] = TENANTS.map((t) => t.tenantId);
const AGENTS = ["intake", "support", "care_coordinator", "clinical_copilot"];
const DEFAULT_NAMES = { intake: "Intake agent", support: "Support agent", care_coordinator: "Care coordinator", clinical_copilot: "Clinical copilot" };
const CHANNELS = { intake: ["chat"], support: ["chat", "email", "sms", "voice"], care_coordinator: ["chat", "sms", "email", "voice", "job"], clinical_copilot: ["job"] };
const MAXIMA = { monthlySpendCapCents: 500_000, dailyReplyCap: 10_000, refundCapCents: 50_000 };

/**
 * As the API's tool policy (src/modules/agents/policy.ts). The real API has
 * none of these routes yet; preview pretends the consult ones exist, so the
 * auto switch can be seen and tested.
 */
const PRETEND_AVAILABLE = new Set(["get_next_consult", "list_consult_times", "book_consult"]);
const tool = (name, changesData, ceiling, waitingOn) => ({ name, changesData, ceiling, waitingOn });
const TOOLS = {
  intake: [
    tool("get_intake_progress", false, "approve", "intake and protocol engine"),
    tool("list_consult_times", false, "approve", "EMR and consults"),
    tool("book_consult", true, "auto", "EMR and consults"),
  ],
  support: [
    tool("search_help_centre", false, "approve", "support and CRM"),
    tool("get_order_status", false, "approve", "Parchment prescribing and orders"),
    tool("get_next_consult", false, "approve", "EMR and consults"),
    tool("request_refund", true, "approve", "billing"),
  ],
  care_coordinator: [
    tool("get_care_plan", false, "approve", "EMR and consults"),
    tool("send_template_message", true, "auto", "support and CRM"),
    tool("list_consult_times", false, "approve", "EMR and consults"),
    tool("book_review_consult", true, "auto", "EMR and consults"),
  ],
  clinical_copilot: [
    tool("get_intake_answers", false, "approve", "intake and protocol engine"),
    tool("get_protocol_checklist", false, "approve", "intake and protocol engine"),
    tool("save_intake_summary", true, "approve", "intake and protocol engine"),
  ],
};
const EVALS = { intake: "passed", support: "passed", care_coordinator: "none", clinical_copilot: "stale" };

const settings = new Map(); // `${tenantId}:${agent}` → settings, made the first time someone changes an agent
const paused = new Set(); // tenant ids
settings.set(`${harbour}:support`, {
  enabled: true,
  displayName: "Sam",
  autoTools: [],
  monthlySpendCapCents: 15_000,
  dailyReplyCap: 1_000,
  refundCapCents: 0,
  updatedAt: daysFromNow(-3),
});

const DEFAULTS = { enabled: false, displayName: null, autoTools: [], monthlySpendCapCents: 15_000, dailyReplyCap: 1_000, refundCapCents: 0, updatedAt: null };
const settingsOf = (tenantId, agent) => settings.get(`${tenantId}:${agent}`) ?? null;
const canBeAuto = (agent, name) => TOOLS[agent].some((t) => t.name === name && t.changesData && t.ceiling === "auto" && PRETEND_AVAILABLE.has(t.name));

const runs = [];
const conversations = new Map();
const proposals = [];

function seed() {
  const conversation = (agent, channel, messages, tenantId = harbour) => {
    const id = newId("50000000");
    conversations.set(id, { conversationId: id, tenantId, agent, channel, patientId: newId("60000000"), verified: channel === "chat", status: "open", handoffReason: null, createdAt: daysFromNow(-1), messages });
    return id;
  };
  const line = (role, blocks, minutesAgo, runId = null) => ({ role, blocks, untrusted: role === "patient", runId, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() });
  const text = (t) => ({ type: "text", text: t });

  const run = (agent, conversationId, status, endReason, steps, costCents, hoursAgo, trigger = "message") => {
    const runId = newId("70000000");
    const at = daysFromNow(-hoursAgo / 24);
    const tenantId = conversations.get(conversationId).tenantId;
    runs.push({ runId, tenantId, agent, conversationId, trigger, status, endReason, agentVersion: "3f9a1c0d2b4e6a71", model: "claude", steps, inputTokens: 1800 * steps, outputTokens: 120 * steps, costCents, queuedAt: at, startedAt: at, endedAt: at });
    return runId;
  };

  const booking = conversation("intake", "chat", []);
  const bookingRun = run("intake", booking, "completed", "replied", 3, 2, 2);
  conversations.get(booking).messages.push(
    line("patient", [text("Hi, I've finished the questions. Can I book in for Tuesday morning?")], 130),
    line("agent", [{ type: "tool_use", id: "tu_1", name: "list_consult_times", input: { from: "2026-12-01" } }], 129, bookingRun),
    line("tool", [{ type: "tool_result", toolUseId: "tu_1", content: '{"times":["2026-12-01T09:00:00+11:00","2026-12-01T09:30:00+11:00"]}', isError: false }], 129, bookingRun),
    line("agent", [{ type: "tool_use", id: "tu_2", name: "book_consult", input: { startsAt: "2026-12-01T09:00:00+11:00" } }], 128, bookingRun),
    line("tool", [{ type: "tool_result", toolUseId: "tu_2", content: "Sent to a person for approval. It has not happened yet.", isError: false }], 128, bookingRun),
    line("agent", [text("I've asked the team to book you in for 9 am on Tuesday 1 December. A person will confirm it shortly.")], 128, bookingRun),
  );
  proposals.push(proposal("intake", "book_consult", { startsAt: "2026-12-01T09:00:00+11:00" }, booking, bookingRun, 2));

  const refund = conversation("support", "chat", []);
  const refundRun = run("support", refund, "completed", "replied", 2, 1, 5);
  conversations.get(refund).messages.push(
    line("patient", [text("My last order arrived damaged. Can I get my money back? My email is [email].")], 300),
    line("agent", [{ type: "tool_use", id: "tu_3", name: "request_refund", input: { orderId: "ORD-1042", amountCents: 8900 } }], 299, refundRun),
    line("tool", [{ type: "tool_result", toolUseId: "tu_3", content: "Sent to a person for approval. It has not happened yet.", isError: false }], 299, refundRun),
    line("agent", [text("Sorry about that. I've asked the team to refund $89.00 for order ORD-1042, and a person will confirm it.")], 299, refundRun),
  );
  proposals.push(proposal("support", "request_refund", { orderId: "ORD-1042", amountCents: 8900 }, refund, refundRun, 5));

  const urgent = conversation("support", "chat", [], northside);
  conversations.get(urgent).status = "handed_off";
  conversations.get(urgent).handoffReason = "clinical";
  const urgentRun = run("support", urgent, "handed_off", "hand_off", 1, 1, 26);
  conversations.get(urgent).messages.push(
    line("patient", [text("Is it normal to feel dizzy after the second week?")], 26 * 60),
    line("agent", [{ type: "tool_use", id: "tu_4", name: "hand_off", input: { reason: "clinical", note: "Asks about a side effect." } }], 26 * 60, urgentRun),
    line("tool", [{ type: "tool_result", toolUseId: "tu_4", content: "Handed to a person.", isError: false }], 26 * 60, urgentRun),
  );

  run("support", refund, "handed_off", "spend_cap", 0, 0, 30);
  run("care_coordinator", booking, "stopped", "agent_off", 0, 0, 50, "schedule");

  const done = proposal("intake", "book_consult", { startsAt: "2026-11-18T10:00:00+11:00" }, booking, bookingRun, 60);
  Object.assign(done, { status: "executed", decidedBy: "00000000-0000-4000-8000-000000000001", decidedAt: daysFromNow(-2.4), resultStatus: 201, executedAt: daysFromNow(-2.4) });
  proposals.push(done);
}

function proposal(agent, toolName, input, conversationId, runId, hoursAgo) {
  return {
    proposalId: newId("80000000"),
    tenantId: harbour,
    agent,
    tool: toolName,
    permission: "agents:read",
    input,
    finalInput: null,
    rationale: null,
    status: "pending",
    conversationId,
    runId,
    createdAt: daysFromNow(-hoursAgo / 24),
    expiresAt: daysFromNow(7 - hoursAgo / 24),
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
    resultStatus: null,
    executedAt: null,
  };
}

seed();

function summary(tenantId, agent) {
  const row = settingsOf(tenantId, agent);
  const s = row ?? DEFAULTS;
  const off = paused.has(tenantId) ? "tenant_paused" : s.enabled ? null : "agent_off";
  const spent = runs.filter((r) => r.tenantId === tenantId && r.agent === agent).reduce((sum, r) => sum + r.costCents, 0);
  const today = runs.filter((r) => r.tenantId === tenantId && r.agent === agent && Date.now() - Date.parse(r.queuedAt) < 24 * 3600 * 1000).length;
  return {
    agent,
    name: s.displayName ?? DEFAULT_NAMES[agent],
    defaultName: DEFAULT_NAMES[agent],
    enabled: s.enabled,
    off,
    version: "3f9a1c0d2b4e6a71",
    evals: EVALS[agent],
    channels: CHANNELS[agent],
    tools: TOOLS[agent].map((t) => ({
      name: t.name,
      changesData: t.changesData,
      ceiling: t.ceiling,
      auto: s.autoTools.includes(t.name),
      available: PRETEND_AVAILABLE.has(t.name),
      waitingOn: PRETEND_AVAILABLE.has(t.name) ? null : t.waitingOn,
    })),
    autoTools: s.autoTools,
    monthlySpendCapCents: s.monthlySpendCapCents,
    dailyReplyCap: s.dailyReplyCap,
    refundCapCents: s.refundCapCents,
    usage: { monthSpendCents: spent, runsToday: today },
    updatedAt: s.updatedAt,
  };
}

function list(req, res) {
  const mine = tenantOf(req, res, "agents:read");
  if (!mine) return;
  send(res, 200, { paused: paused.has(mine.tenantId), platformOn: true, agents: AGENTS.map((a) => summary(mine.tenantId, a)) });
}

async function change(req, res, [agent]) {
  const mine = tenantOf(req, res, "agents:manage");
  if (!mine) return;
  if (!AGENTS.includes(agent)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const body = await readJson(req);
  const keys = ["enabled", "displayName", "autoTools", "monthlySpendCapCents", "dailyReplyCap", "refundCapCents"];
  if (!isObject(body) || Object.keys(body).length === 0 || !Object.keys(body).every((k) => keys.includes(k))) return fail(res, 400, "bad_request", BAD_REQUEST);
  for (const [key, max] of Object.entries(MAXIMA)) {
    if (key in body && !(Number.isInteger(body[key]) && body[key] >= 0 && body[key] <= max)) return fail(res, 400, "bad_request", BAD_REQUEST);
  }
  const before = settingsOf(mine.tenantId, agent) ?? DEFAULTS;
  const next = { ...before, ...body, updatedAt: new Date().toISOString() };
  if (typeof next.displayName === "string") next.displayName = next.displayName.trim() || null;
  const notAllowed = (next.autoTools ?? []).filter((name) => !canBeAuto(agent, name));
  if (notAllowed.length > 0) return fail(res, 409, "tool_ceiling", `These tools can't run without approval: ${notAllowed.join(", ")}`);
  if (next.enabled && !before.enabled) {
    if (EVALS[agent] !== "passed") return fail(res, 409, "eval_required", "This agent's current version has no passing eval result, so it can't be switched on");
    if (next.monthlySpendCapCents <= 0) return fail(res, 409, "spend_cap_required", "Set a monthly spending cap above zero first");
  }
  settings.set(`${mine.tenantId}:${agent}`, next);
  send(res, 200, summary(mine.tenantId, agent));
}

function pause(value) {
  return (req, res) => {
    const mine = tenantOf(req, res, "agents:manage");
    if (!mine) return;
    if (value) paused.add(mine.tenantId);
    else paused.delete(mine.tenantId);
    send(res, 200, { paused: value });
  };
}

function listRuns(req, res) {
  const mine = tenantOf(req, res, "agents:read");
  if (!mine) return;
  const rows = runs
    .filter((r) => r.tenantId === mine.tenantId)
    .sort((a, b) => Date.parse(b.queuedAt) - Date.parse(a.queuedAt))
    .slice(0, 50)
    .map(untenanted);
  send(res, 200, { runs: rows });
}

/** A stored row as the API sends it: the tenant is the caller's own, so it isn't repeated. */
function untenanted(row) {
  const reply = { ...row };
  delete reply.tenantId;
  return reply;
}

function conversation(req, res, [id]) {
  const mine = tenantOf(req, res, "agents:transcripts");
  if (!mine) return;
  const found = conversations.get(id);
  if (!found || found.tenantId !== mine.tenantId) return fail(res, 404, "not_found", "Conversation not found");
  const { messages, ...rest } = untenanted(found);
  send(res, 200, { ...rest, messages: messages.map((m, i) => ({ id: i + 1, ...m })) });
}

const visible = (mine, p) => p.tenantId === mine.tenantId && usablePermissionsOf(mine).includes(p.permission);
const statusOf = (p) => (p.status === "pending" && Date.parse(p.expiresAt) <= Date.now() ? "expired" : p.status);
const card = (p) => ({ ...untenanted(p), status: statusOf(p) });

function listProposals(req, res) {
  const mine = tenantOf(req, res);
  if (!mine) return;
  const state = new URL(req.url, "http://mock").searchParams.get("state") ?? "pending";
  const rows = proposals
    .filter((p) => visible(mine, p) && (state === "pending" ? statusOf(p) === "pending" : statusOf(p) !== "pending"))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(card);
  send(res, 200, { proposals: rows });
}

function findProposal(req, res, id) {
  const mine = tenantOf(req, res);
  if (!mine) return null;
  const p = proposals.find((x) => x.proposalId === id);
  if (!p || !visible(mine, p)) {
    fail(res, 404, "not_found", "Approval card not found");
    return null;
  }
  return { mine, p };
}

const REFUSED = { expired: "This card has expired. The agent can propose it again.", already_decided: "This card has already been decided." };

async function approve(req, res, [id]) {
  const found = findProposal(req, res, id);
  if (!found) return;
  const { mine, p } = found;
  const body = (await readJson(req)) ?? {};
  if (!isObject(body)) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (p.status !== "pending") return fail(res, 409, "proposal_already_decided", REFUSED.already_decided);
  if (statusOf(p) === "expired") {
    p.status = "expired";
    return fail(res, 409, "proposal_expired", REFUSED.expired);
  }
  const now = new Date().toISOString();
  Object.assign(p, {
    status: "executed",
    finalInput: body.finalInput ?? null,
    decisionReason: body.finalInput ? (body.reason ?? "edited") : (body.reason ?? null),
    decidedBy: mine.userId,
    decidedAt: now,
    resultStatus: 201,
    executedAt: now,
  });
  send(res, 200, card(p));
}

async function reject(req, res, [id]) {
  const found = findProposal(req, res, id);
  if (!found) return;
  const { mine, p } = found;
  const body = await readJson(req);
  if (!isObject(body) || typeof body.reason !== "string") return fail(res, 400, "bad_request", BAD_REQUEST);
  if (p.status !== "pending") return fail(res, 409, "already_decided", "This card has already been decided");
  Object.assign(p, { status: "rejected", decisionReason: body.reason, decidedBy: mine.userId, decidedAt: new Date().toISOString() });
  send(res, 200, card(p));
}

const ID = "([0-9a-f-]{36})";
export const agentRoutes = [
  ["GET", /^\/v1\/agents$/, list],
  ["POST", /^\/v1\/agents\/pause$/, pause(true)],
  ["POST", /^\/v1\/agents\/resume$/, pause(false)],
  ["PATCH", /^\/v1\/agents\/([a-z_]+)$/, change],
  ["GET", /^\/v1\/agent-runs$/, listRuns],
  ["GET", new RegExp(`^/v1/agent-conversations/${ID}$`), conversation],
  ["GET", /^\/v1\/agent-proposals$/, listProposals],
  ["GET", new RegExp(`^/v1/agent-proposals/${ID}$`), (req, res, [id]) => {
    const found = findProposal(req, res, id);
    if (found) send(res, 200, card(found.p));
  }],
  ["POST", new RegExp(`^/v1/agent-proposals/${ID}/approve$`), approve],
  ["POST", new RegExp(`^/v1/agent-proposals/${ID}/reject$`), reject],
];
