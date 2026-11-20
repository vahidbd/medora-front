/**
 * The mock API's patient routes as staff call them: the list and search,
 * a patient's details, identity checks and IHI status, consents, consent
 * documents, a patient's intakes and the prescriber's intake summary. Every
 * person here is made up, with made-up contact details from the
 * example.test domain and numbers no real person holds. The rules a screen
 * shows (break_glass_required on a summary, attempts left, one decision per
 * current version) follow the API.
 */
import { BAD_REQUEST, fail, isObject, readJson, send } from "./http.mjs";
import { daysFromNow, ME, newId, TENANTS } from "./people.mjs";
import { programs } from "./protocols.mjs";
import { tenantOf } from "./staff.mjs";

const [harbour, coastal] = TENANTS.map((t) => t.tenantId);
const KINDS = ["privacy", "telehealth_terms", "identity_check", "pharmacy_sharing"];
const CARE = new Set(["privacy", "telehealth_terms"]);

function patient(n, tenantId, givenName, familyName, dateOfBirth, identityStatus, extra = {}) {
  return {
    patientId: `90000000-0000-4000-8000-00000000000${n}`,
    tenantId,
    givenName,
    familyName,
    preferredName: null,
    dateOfBirth,
    sex: "not_stated",
    timeZone: null,
    identityStatus,
    email: `${givenName.toLowerCase()}.${familyName.toLowerCase()}@example.test`,
    mobile: null,
    address: null,
    medicare: null,
    createdAt: daysFromNow(-n * 9),
    attemptsLeft: 3,
    checks: [],
    ihi: null,
    ...extra,
  };
}

const patients = [
  patient(1, harbour, "Mia", "Example", "1988-03-14", "verified", {
    preferredName: "Mimi",
    sex: "female",
    mobile: "0400 000 001",
    address: { line1: "1 Example Street", line2: null, suburb: "Sampletown", state: "NSW", postcode: "2000" },
    medicare: { masked: "•••• ••••• 1", irn: "1", validTo: "2028-06" },
    checks: [{ method: "document", documentType: "driver_licence", outcome: "verified", at: daysFromNow(-8), checkedBy: null }],
    ihi: { found: true, status: "active", recordStatus: "verified", checkedAt: daysFromNow(-8) },
  }),
  patient(2, harbour, "Noah", "Sample", "1975-11-02", "unverified", { sex: "male" }),
  patient(3, harbour, "Ivy", "Placeholder", "1992-07-30", "failed", {
    attemptsLeft: 0,
    checks: [1, 2, 3].map((i) => ({ method: "document", documentType: "driver_licence", outcome: "not_matched", at: daysFromNow(-i), checkedBy: null })),
  }),
  patient(4, coastal, "Leo", "Example", "1981-01-20", "unverified"),
];

const documents = [
  doc(1, harbour, "privacy", 1, "Privacy and collection notice", -60),
  doc(2, harbour, "privacy", 2, "Privacy and collection notice", -5),
  doc(3, harbour, "telehealth_terms", 1, "Telehealth terms", -60),
  doc(4, harbour, "identity_check", 1, "Checking your identity", -60),
  doc(5, coastal, "privacy", 1, "Privacy and collection notice", -30),
];
function doc(n, tenantId, kind, version, title, days) {
  return { documentId: `91000000-0000-4000-8000-00000000000${n}`, tenantId, kind, version, title, body: "Made-up text for preview.\n\nA second paragraph.", publishedAt: daysFromNow(days) };
}

/** Decisions, newest last: who decided what, on which version. */
const decisions = [
  { patientId: patients[0].patientId, kind: "privacy", version: 2, decision: "given" },
  { patientId: patients[0].patientId, kind: "telehealth_terms", version: 1, decision: "given" },
  { patientId: patients[0].patientId, kind: "identity_check", version: 1, decision: "given" },
  { patientId: patients[1].patientId, kind: "privacy", version: 1, decision: "given" },
  { patientId: patients[1].patientId, kind: "telehealth_terms", version: 1, decision: "given" },
];

const intakes = [
  { intakeId: "92000000-0000-4000-8000-000000000001", patientId: patients[0].patientId, status: "completed", endedReason: null, startedAt: daysFromNow(-9), submittedAt: daysFromNow(-8), endedAt: null },
  { intakeId: "92000000-0000-4000-8000-000000000002", patientId: patients[0].patientId, status: "ineligible", endedReason: null, startedAt: daysFromNow(-40), submittedAt: null, endedAt: daysFromNow(-40) },
  { intakeId: "92000000-0000-4000-8000-000000000003", patientId: patients[1].patientId, status: "in_progress", endedReason: null, startedAt: daysFromNow(-1), submittedAt: null, endedAt: null },
];

const summaries = {
  [intakes[0].intakeId]: {
    outcome: "red_flags",
    stop: null,
    redFlags: [{ rule: "gallbladder", message: "Gallbladder disease" }],
    derived: [{ key: "bmi", label: "BMI", value: 33.9, unit: null }],
    items: [
      { questionKey: "height", question: "How tall are you?", answer: "170 cm", redFlag: false },
      { questionKey: "weight", question: "How much do you weigh?", answer: "98 kg", redFlag: false },
      { questionKey: "pregnant", question: "Are you pregnant, or planning to be?", answer: "No", redFlag: false },
      { questionKey: "conditions", question: "Do you have any of these?", answer: "Gallbladder disease; Sleep apnoea", redFlag: true },
    ],
    earlierIneligible: [{ intakeId: intakes[1].intakeId, submittedAt: intakes[1].endedAt, rule: "BMI under 27" }],
  },
  [intakes[1].intakeId]: {
    outcome: "ineligible",
    stop: { rule: "bmi_low", message: "BMI under 27" },
    redFlags: [],
    derived: [{ key: "bmi", label: "BMI", value: 25.1, unit: null }],
    items: [
      { questionKey: "height", question: "How tall are you?", answer: "170 cm", redFlag: false },
      { questionKey: "weight", question: "How much do you weigh?", answer: "72.5 kg", redFlag: false },
    ],
    earlierIneligible: [],
  },
};

const displayName = (p) => `${p.preferredName ?? p.givenName} ${p.familyName}`;
const listItem = (p) => ({ patientId: p.patientId, displayName: displayName(p), givenName: p.givenName, familyName: p.familyName, dateOfBirth: p.dateOfBirth, identityStatus: p.identityStatus, createdAt: p.createdAt });
const details = (p) => ({
  patientId: p.patientId,
  givenName: p.givenName,
  familyName: p.familyName,
  preferredName: p.preferredName,
  displayName: displayName(p),
  dateOfBirth: p.dateOfBirth,
  sex: p.sex,
  timeZone: p.timeZone,
  identityStatus: p.identityStatus,
  email: p.email,
  mobile: p.mobile,
  address: p.address,
  medicare: p.medicare,
  createdAt: p.createdAt,
});
const identityOf = (p) => {
  const verified = p.checks.find((c) => c.outcome === "verified");
  return { identityStatus: p.identityStatus, attemptsLeft: p.attemptsLeft, verification: verified ? { method: verified.method, documentType: verified.documentType, at: verified.at } : null, ihi: p.ihi, checks: p.checks };
};
const replyOf = ({ documentId, kind, version, title, body, publishedAt }) => ({ documentId, kind, version, title, body, publishedAt });
const current = (tenantId, kind) => documents.filter((d) => d.tenantId === tenantId && d.kind === kind).sort((a, b) => b.version - a.version)[0] ?? null;
function consentsOf(p) {
  return KINDS.map((kind) => {
    const document = current(p.tenantId, kind);
    const last = decisions.filter((d) => d.patientId === p.patientId && d.kind === kind).at(-1) ?? null;
    const given = last?.decision === "given" && last.version === document?.version;
    return { kind, document: document && replyOf(document), decision: last?.decision ?? null, decidedVersion: last?.version ?? null, needed: CARE.has(kind) && document !== null && !given };
  });
}

function patientOf(req, res, id, permission = "patients:read") {
  const mine = tenantOf(req, res, permission);
  if (!mine) return null;
  const found = patients.find((p) => p.tenantId === mine.tenantId && p.patientId === id);
  if (!found) fail(res, 404, "not_found", "Patient not found");
  return found ?? null;
}

function list(req, res) {
  const mine = tenantOf(req, res, "patients:read");
  if (!mine) return;
  const search = (new URL(req.url, "http://mock").searchParams.get("search") ?? "").trim().toLowerCase();
  const words = search.split(/\s+/).filter(Boolean);
  const rows = patients
    .filter((p) => p.tenantId === mine.tenantId)
    .filter((p) => words.every((w) => [p.givenName, p.familyName, p.preferredName ?? "", p.email ?? ""].some((field) => field.toLowerCase().startsWith(w))));
  send(res, 200, { patients: rows.map(listItem) });
}

function getOne(req, res, [id]) {
  const p = patientOf(req, res, id);
  if (p) send(res, 200, details(p));
}

function identity(req, res, [id]) {
  const p = patientOf(req, res, id);
  if (p) send(res, 200, identityOf(p));
}

async function verifyManually(req, res, [id]) {
  const p = patientOf(req, res, id, "patients:verify_identity");
  if (!p) return;
  const body = await readJson(req);
  if (!isObject(body) || !["driver_licence", "passport", "medicare_card"].includes(body.documentType) || typeof body.reason !== "string" || !body.reason.trim()) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (p.identityStatus === "verified") return fail(res, 409, "already_verified", "This patient's identity is already verified");
  p.checks.unshift({ method: "manual", documentType: body.documentType, outcome: "verified", at: new Date().toISOString(), checkedBy: ME.userId });
  p.identityStatus = "verified";
  p.ihi = { found: true, status: "active", recordStatus: "verified", checkedAt: new Date().toISOString() };
  send(res, 200, identityOf(p));
}

async function reopen(req, res, [id]) {
  const p = patientOf(req, res, id, "patients:manage");
  if (!p) return;
  const body = await readJson(req);
  if (!isObject(body) || typeof body.reason !== "string" || !body.reason.trim()) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (p.identityStatus !== "failed") return fail(res, 409, "not_failed", "Only a patient whose checks didn't match can try again");
  Object.assign(p, { identityStatus: "unverified", attemptsLeft: 3 });
  send(res, 200, identityOf(p));
}

function lookUpIhi(req, res, [id]) {
  const p = patientOf(req, res, id, "patients:manage");
  if (!p) return;
  if (p.identityStatus !== "verified") return fail(res, 409, "identity_unverified", "Verify the patient's identity before looking up their IHI");
  p.ihi = { found: true, status: "active", recordStatus: "verified", checkedAt: new Date().toISOString() };
  send(res, 200, identityOf(p));
}

async function consents(req, res, [id], method) {
  const p = patientOf(req, res, id, method === "POST" ? "patients:manage" : "patients:read");
  if (!p) return;
  if (method === "POST") {
    const body = await readJson(req);
    const ok = isObject(body) && ["given", "withdrawn"].includes(body.decision) && ["phone", "in_person"].includes(body.channel) && typeof body.reason === "string" && body.reason.trim();
    if (!ok) return fail(res, 400, "bad_request", BAD_REQUEST);
    const document = documents.find((d) => d.tenantId === p.tenantId && d.documentId === body.documentId);
    if (!document) return fail(res, 404, "not_found", "Consent document not found");
    if (current(p.tenantId, document.kind)?.documentId !== document.documentId) return fail(res, 409, "not_current_version", "That isn't the current version of this document");
    decisions.push({ patientId: p.patientId, kind: document.kind, version: document.version, decision: body.decision });
  }
  send(res, 200, { consents: consentsOf(p) });
}

function patientIntakes(req, res, [id]) {
  const p = patientOf(req, res, id);
  if (!p) return;
  const program = programs[0];
  const rows = intakes
    .filter((i) => i.patientId === p.patientId)
    .map(({ intakeId, status, endedReason, startedAt, submittedAt, endedAt }) => ({ intakeId, programId: program.programId, programName: program.name, status, endedReason, startedAt, submittedAt, endedAt }));
  send(res, 200, { intakes: rows });
}

function summary(req, res, [id]) {
  const mine = tenantOf(req, res, "intakes:read");
  if (!mine) return;
  const intake = intakes.find((i) => i.intakeId === id && summaries[i.intakeId]);
  const p = intake && patients.find((x) => x.patientId === intake.patientId && x.tenantId === mine.tenantId);
  if (!p) return fail(res, 404, "not_found", "Intake not found");
  const program = programs[0];
  const at = intake.submittedAt ?? intake.endedAt;
  send(res, 200, {
    intakeId: intake.intakeId,
    patientId: p.patientId,
    programId: program.programId,
    programName: program.name,
    protocolName: "Weight management",
    protocolVersion: 1,
    versionWithdrawn: false,
    status: intake.status,
    submittedAt: at,
    stale: Date.now() - Date.parse(at) > 30 * 86_400_000,
    dateOfBirthDiffers: false,
    ...summaries[intake.intakeId],
  });
}

function consentDocuments(req, res) {
  const mine = tenantOf(req, res, "patients:read");
  if (mine) send(res, 200, { documents: documents.filter((d) => d.tenantId === mine.tenantId).sort((a, b) => a.kind.localeCompare(b.kind) || b.version - a.version).map(replyOf) });
}

async function publish(req, res) {
  const mine = tenantOf(req, res, "consents:manage");
  if (!mine) return;
  const body = await readJson(req);
  const ok = isObject(body) && KINDS.includes(body.kind) && typeof body.title === "string" && body.title.trim() && typeof body.body === "string" && body.body.trim();
  if (!ok) return fail(res, 400, "bad_request", BAD_REQUEST);
  const version = (current(mine.tenantId, body.kind)?.version ?? 0) + 1;
  const row = { documentId: newId("91000000"), tenantId: mine.tenantId, kind: body.kind, version, title: body.title.trim(), body: body.body.trim(), publishedAt: new Date().toISOString() };
  documents.push(row);
  send(res, 201, replyOf(row));
}

const ID = "([0-9a-f-]{36})";
export const patientRoutes = [
  ["GET", /^\/v1\/patients$/, list],
  ["GET", new RegExp(`^/v1/patients/${ID}$`), getOne],
  ["GET", new RegExp(`^/v1/patients/${ID}/identity$`), identity],
  ["POST", new RegExp(`^/v1/patients/${ID}/identity/manual$`), verifyManually],
  ["POST", new RegExp(`^/v1/patients/${ID}/identity/reopen$`), reopen],
  ["POST", new RegExp(`^/v1/patients/${ID}/ihi-lookup$`), lookUpIhi],
  ["GET", new RegExp(`^/v1/patients/${ID}/consents$`), consents],
  ["POST", new RegExp(`^/v1/patients/${ID}/consents$`), consents],
  ["GET", new RegExp(`^/v1/patients/${ID}/intakes$`), patientIntakes],
  ["GET", new RegExp(`^/v1/intakes/${ID}$`), summary],
  ["GET", /^\/v1\/consent-documents$/, consentDocuments],
  ["POST", /^\/v1\/consent-documents$/, publish],
];
