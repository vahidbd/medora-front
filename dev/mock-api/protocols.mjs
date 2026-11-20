/**
 * The mock API's protocol and program routes: templates, protocols and
 * their versions, drafts, sign-off and withdrawal, and programs, with the
 * API's rules where a screen shows their refusals (draft_exists, no_draft,
 * name_taken, protocol_problems, registration_needed, not_a_draft,
 * nothing_live, program_status, protocol_not_live, program_retired). The
 * definitions are made up and short; the real template has more.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import { daysFromNow, ME, newId, TENANTS } from "./people.mjs";
import { tenantOf } from "./staff.mjs";

const [harbour] = TENANTS.map((t) => t.tenantId);

const definition = (extra = []) => ({
  steps: [
    {
      key: "about_you",
      title: "About you",
      questions: [
        { key: "height", label: "How tall are you?", kind: "number", unit: "cm", min: 120, max: 230, required: true },
        { key: "weight", label: "How much do you weigh?", kind: "number", unit: "kg", min: 35, max: 300, required: true },
      ],
    },
    {
      key: "health",
      title: "Your health",
      questions: [
        { key: "pregnant", label: "Are you pregnant, or planning to be?", kind: "yes_no", required: true },
        {
          key: "conditions",
          label: "Do you have any of these?",
          kind: "multi_choice",
          required: false,
          options: [
            { value: "gallbladder", label: "Gallbladder disease" },
            { value: "kidney", label: "Kidney disease" },
            { value: "sleep_apnoea", label: "Sleep apnoea" },
          ],
        },
        ...extra,
      ],
    },
  ],
  derived: [{ key: "bmi", label: "BMI", decimals: 1, formula: { op: "divide", of: [{ answer: "weight" }, { op: "multiply", of: [{ answer: "height" }, { answer: "height" }] }] } }],
  rules: [
    { key: "pregnancy", outcome: "hard_stop", when: { answer: "pregnant", is: "equals", value: true }, prescriberLabel: "Pregnant or planning pregnancy", patientMessage: "This treatment isn't safe during pregnancy." },
    { key: "bmi_low", outcome: "hard_stop", when: { derived: "bmi", is: "less_than", value: 27 }, prescriberLabel: "BMI under 27", patientMessage: "This program is for a BMI of 27 or more." },
    { key: "gallbladder", outcome: "red_flag", when: { answer: "conditions", is: "includes", value: "gallbladder" }, prescriberLabel: "Gallbladder disease" },
  ],
});

const templates = [
  {
    key: "weight-management",
    version: 1,
    name: "Weight management",
    condition: "Weight management",
    summary: "Adults 18 to 75 with a BMI of 30, or 27 with a weight-related condition. Hard stops for pregnancy and serious history; red flags for the prescriber.",
    clinicalReview: null,
    definition: definition(),
  },
];

const protocols = [
  {
    protocolId: "80000000-0000-4000-8000-000000000001",
    tenantId: harbour,
    name: "Weight management",
    condition: "Weight management",
    template: { key: "weight-management", version: 1 },
  },
];

const versions = [
  {
    versionId: "81000000-0000-4000-8000-000000000001",
    protocolId: protocols[0].protocolId,
    version: 1,
    status: "live",
    editedAt: daysFromNow(-40),
    signedOffAt: daysFromNow(-38),
    signedOffBy: ME.userId,
    withdrawnAt: null,
    definition: definition(),
    signerRegistration: "MED0001234567",
    attestation: 'I have reviewed version 1 of the protocol "Weight management" and approve it for use with patients, under Ahpra registration MED0001234567.',
    withdrawnReason: null,
  },
  {
    versionId: "81000000-0000-4000-8000-000000000002",
    protocolId: protocols[0].protocolId,
    version: 2,
    status: "draft",
    editedAt: daysFromNow(-2),
    signedOffAt: null,
    signedOffBy: null,
    withdrawnAt: null,
    definition: definition([{ key: "tried_before", label: "Have you used a weight-loss medicine before?", kind: "yes_no", required: true }]),
    signerRegistration: null,
    attestation: null,
    withdrawnReason: null,
  },
];

export const programs = [
  {
    programId: "82000000-0000-4000-8000-000000000001",
    tenantId: harbour,
    brandId: "60000000-0000-4000-8000-000000000001",
    protocolId: protocols[0].protocolId,
    name: "Harbour weight care",
    status: "live",
    measurements: ["weight", "waist"],
    checkInEveryDays: 28,
  },
];

const versionsOf = (protocolId) => versions.filter((v) => v.protocolId === protocolId).sort((a, b) => a.version - b.version);
const summaryOf = ({ protocolId, name, condition, template }) => {
  const all = versionsOf(protocolId);
  return {
    protocolId,
    name,
    condition,
    template,
    liveVersion: all.find((v) => v.status === "live")?.version ?? null,
    draftVersion: all.find((v) => v.status === "draft")?.version ?? null,
  };
};
const versionSummary = ({ versionId, version, status, editedAt, signedOffAt, signedOffBy, withdrawnAt }) => ({ versionId, version, status, editedAt, signedOffAt, signedOffBy, withdrawnAt });
const detailOf = (p) => ({ ...summaryOf(p), versions: versionsOf(p.protocolId).map(versionSummary) });
const versionDetail = (v) => ({ ...v });
const programReply = (p) => ({
  programId: p.programId,
  brandId: p.brandId,
  protocolId: p.protocolId,
  condition: protocols.find((x) => x.protocolId === p.protocolId)?.condition ?? "",
  name: p.name,
  status: p.status,
  measurements: p.measurements,
  checkInEveryDays: p.checkInEveryDays,
});

function protocolOf(res, mine, id) {
  const protocol = protocols.find((p) => p.tenantId === mine.tenantId && p.protocolId === id);
  if (!protocol) fail(res, 404, "not_found", "Protocol not found");
  return protocol ?? null;
}

/** The few checks a screen shows (the API checks everything): steps with questions, rules with a label. */
function problemsOf(def) {
  if (!isObject(def)) return [{ path: "", message: "Expected an object" }];
  const problems = [];
  if (!Array.isArray(def.steps) || def.steps.length === 0) problems.push({ path: "steps", message: "Add at least one step" });
  for (const [i, step] of (Array.isArray(def.steps) ? def.steps : []).entries()) {
    if (!isObject(step) || !Array.isArray(step.questions) || step.questions.length === 0) problems.push({ path: `steps.${i}.questions`, message: "Add at least one question" });
  }
  for (const [i, rule] of (Array.isArray(def.rules) ? def.rules : []).entries()) {
    if (!isObject(rule) || typeof rule.prescriberLabel !== "string") problems.push({ path: `rules.${i}.prescriberLabel`, message: "Required" });
  }
  return problems;
}

function list(req, res) {
  const mine = tenantOf(req, res, "protocols:read");
  if (mine) send(res, 200, { protocols: protocols.filter((p) => p.tenantId === mine.tenantId).map(summaryOf) });
}

function listTemplates(req, res) {
  if (tenantOf(req, res, "protocols:read")) send(res, 200, { templates });
}

async function create(req, res) {
  const mine = tenantOf(req, res, "protocols:manage");
  if (!mine) return;
  const body = await readJson(req);
  const name = isObject(body) && typeof body.name === "string" ? body.name.trim() : "";
  if (!name || (body.templateKey === undefined) === (body.definition === undefined)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const template = body.templateKey === undefined ? null : templates.find((t) => t.key === body.templateKey);
  if (body.templateKey !== undefined && !template) return fail(res, 404, "not_found", "Protocol template not found");
  const condition = (typeof body.condition === "string" ? body.condition.trim() : "") || template?.condition;
  if (!condition) return fail(res, 409, "condition_needed", "Name the condition this protocol treats");
  if (protocols.some((p) => p.tenantId === mine.tenantId && p.name.toLowerCase() === name.toLowerCase())) return fail(res, 409, "name_taken", "There is already a protocol with that name");
  const def = template ? structuredClone(template.definition) : body.definition;
  const problems = problemsOf(def);
  if (problems.length > 0) return fail(res, 400, "protocol_problems", "The protocol has problems to fix", { problems });
  const protocol = { protocolId: newId("80000000"), tenantId: mine.tenantId, name, condition, template: template ? { key: template.key, version: template.version } : null };
  protocols.push(protocol);
  versions.push({ versionId: newId("81000000"), protocolId: protocol.protocolId, version: 1, status: "draft", editedAt: new Date().toISOString(), signedOffAt: null, signedOffBy: null, withdrawnAt: null, definition: def, signerRegistration: null, attestation: null, withdrawnReason: null });
  send(res, 201, detailOf(protocol));
}

function getOne(req, res, [id]) {
  const mine = tenantOf(req, res, "protocols:read");
  const protocol = mine && protocolOf(res, mine, id);
  if (protocol) send(res, 200, detailOf(protocol));
}

function getVersion(req, res, [id, number]) {
  const mine = tenantOf(req, res, "protocols:read");
  const protocol = mine && protocolOf(res, mine, id);
  if (!protocol) return;
  const version = versionsOf(protocol.protocolId).find((v) => v.version === Number(number));
  if (!version) return fail(res, 404, "not_found", "Protocol version not found");
  send(res, 200, versionDetail(version));
}

async function draft(req, res, [id], method) {
  const mine = tenantOf(req, res, "protocols:manage");
  const protocol = mine && protocolOf(res, mine, id);
  if (!protocol) return;
  const all = versionsOf(protocol.protocolId);
  const current = all.find((v) => v.status === "draft");
  if (method === "POST") {
    if (current) return fail(res, 409, "draft_exists", "This protocol already has a draft");
    const latest = all.at(-1);
    const row = { ...latest, versionId: newId("81000000"), version: latest.version + 1, status: "draft", editedAt: new Date().toISOString(), signedOffAt: null, signedOffBy: null, withdrawnAt: null, definition: structuredClone(latest.definition), signerRegistration: null, attestation: null, withdrawnReason: null };
    versions.push(row);
    return send(res, 201, versionDetail(row));
  }
  if (!current) return fail(res, 409, "no_draft", "This protocol has no draft. Start a new version to make changes.");
  const body = await readJson(req);
  if (!isObject(body) || !isObject(body.definition)) return fail(res, 400, "bad_request", BAD_REQUEST);
  const problems = problemsOf(body.definition);
  if (problems.length > 0) return fail(res, 400, "protocol_problems", "The protocol has problems to fix", { problems });
  Object.assign(current, { definition: body.definition, editedAt: new Date().toISOString() });
  send(res, 200, versionDetail(current));
}

async function signOff(req, res, [id]) {
  const mine = tenantOf(req, res, "protocols:sign_off");
  const protocol = mine && protocolOf(res, mine, id);
  if (!protocol) return;
  const body = await readJson(req);
  if (!isObject(body) || body.attest !== true || typeof body.version !== "number" || typeof body.registration !== "string") return fail(res, 400, "bad_request", BAD_REQUEST);
  const registration = body.registration.trim().toUpperCase();
  if (!/^MED\d{10}$/.test(registration)) return fail(res, 409, "registration_needed", "Sign off under your Ahpra registration as a medical practitioner (MED and ten digits)");
  const all = versionsOf(protocol.protocolId);
  const current = all.find((v) => v.status === "draft");
  if (!current || current.version !== body.version) return fail(res, 409, "not_a_draft", "Only the current draft can be signed off");
  const live = all.find((v) => v.status === "live");
  if (live) live.status = "retired";
  Object.assign(current, {
    status: "live",
    signedOffAt: new Date().toISOString(),
    signedOffBy: ME.userId,
    signerRegistration: registration,
    attestation: `I have reviewed version ${current.version} of the protocol "${protocol.name}" and approve it for use with patients, under Ahpra registration ${registration}.`,
  });
  send(res, 200, versionDetail(current));
}

async function withdraw(req, res, [id]) {
  const mine = tenantOf(req, res, "protocols:sign_off");
  const protocol = mine && protocolOf(res, mine, id);
  if (!protocol) return;
  const body = await readJson(req);
  const reason = isObject(body) && typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return fail(res, 400, "bad_request", BAD_REQUEST);
  const live = versionsOf(protocol.protocolId).find((v) => v.status === "live");
  if (!live) return fail(res, 409, "nothing_live", "This protocol has no live version to withdraw");
  Object.assign(live, { status: "withdrawn", withdrawnAt: new Date().toISOString(), withdrawnReason: reason });
  send(res, 200, versionDetail(live));
}

const MOVES = { draft: ["live", "retired"], live: ["paused", "retired"], paused: ["live", "retired"], retired: [] };

function listPrograms(req, res) {
  const mine = tenantOf(req, res);
  if (mine) send(res, 200, { programs: programs.filter((p) => p.tenantId === mine.tenantId).map(programReply) });
}

async function createProgram(req, res) {
  const mine = tenantOf(req, res, "programs:manage");
  if (!mine) return;
  const body = await readJson(req);
  const name = isObject(body) && typeof body.name === "string" ? body.name.trim() : "";
  if (!name || typeof body.brandId !== "string" || typeof body.protocolId !== "string") return fail(res, 400, "bad_request", BAD_REQUEST);
  if (!protocolOf(res, mine, body.protocolId)) return;
  const program = {
    programId: newId("82000000"),
    tenantId: mine.tenantId,
    brandId: body.brandId,
    protocolId: body.protocolId,
    name,
    status: "draft",
    measurements: Array.isArray(body.measurements) ? body.measurements : [],
    checkInEveryDays: typeof body.checkInEveryDays === "number" ? body.checkInEveryDays : null,
  };
  programs.push(program);
  send(res, 201, programReply(program));
}

async function changeProgram(req, res, [id]) {
  const mine = tenantOf(req, res, "programs:manage");
  if (!mine) return;
  const program = programs.find((p) => p.tenantId === mine.tenantId && p.programId === id);
  if (!program) return fail(res, 404, "not_found", "Program not found");
  const body = await readJson(req);
  if (!isObject(body)) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (program.status === "retired") return fail(res, 409, "program_retired", "A retired program can’t be changed");
  if (body.status !== undefined && body.status !== program.status) {
    if (!MOVES[program.status].includes(body.status)) return fail(res, 409, "program_status", `A ${program.status} program can’t become ${body.status}`);
    if (body.status === "live" && !versionsOf(program.protocolId).some((v) => v.status === "live")) {
      return fail(res, 409, "protocol_not_live", "The protocol needs a signed-off live version before the program can go live");
    }
  }
  for (const key of ["name", "measurements", "checkInEveryDays", "status"]) if (body[key] !== undefined) program[key] = typeof body[key] === "string" && key === "name" ? body[key].trim() : body[key];
  send(res, 200, programReply(program));
}

const ID = "([0-9a-f-]{36})";
export const protocolRoutes = [
  ["GET", /^\/v1\/protocol-templates$/, listTemplates],
  ["GET", /^\/v1\/protocols$/, list],
  ["POST", /^\/v1\/protocols$/, create],
  ["GET", new RegExp(`^/v1/protocols/${ID}$`), getOne],
  ["GET", new RegExp(`^/v1/protocols/${ID}/versions/(\\d+)$`), getVersion],
  ["POST", new RegExp(`^/v1/protocols/${ID}/draft$`), draft],
  ["PUT", new RegExp(`^/v1/protocols/${ID}/draft$`), draft],
  ["POST", new RegExp(`^/v1/protocols/${ID}/sign-off$`), signOff],
  ["POST", new RegExp(`^/v1/protocols/${ID}/withdraw$`), withdraw],
  ["GET", /^\/v1\/programs$/, listPrograms],
  ["POST", /^\/v1\/programs$/, createProgram],
  ["PATCH", new RegExp(`^/v1/programs/${ID}$`), changeProgram],
];
