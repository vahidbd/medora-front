/**
 * The mock API's intake routes before an account, in the API's shapes and
 * with its checks and error codes (docs/decisions/intake.md INT5 to INT16 in
 * medora-backend): a brand's open programs, a program's first screen,
 * starting an intake (the resume token comes back once, in a header), and
 * reading and answering one with that token.
 *
 * The programs and their questions are made up, and so are the rules: Kestrel
 * (Harbour's tenant) offers two programs; Larkspur is paused. Weight care's
 * "pregnant" answer and "harm" answer "now" are hard stops, the second with
 * the urgent-help message. Intakes are kept in memory until the mock stops.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { PRIVACY } from "./consents.mjs";
import { BAD_REQUEST, isObject } from "./http.mjs";
import { HARBOUR } from "./patient.mjs";

const TENANT_HEADER = "x-medora-tenant";
const TOKEN_HEADER = "x-medora-intake-token";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KESTREL = "30000000-0000-4000-8000-000000000001";


const WEIGHT = "50000000-0000-4000-8000-000000000001";
const SLEEP = "50000000-0000-4000-8000-000000000002";

const PROGRAMS = [
  {
    programId: WEIGHT,
    brandId: KESTREL,
    tenantId: HARBOUR,
    name: "Weight care (demo)",
    condition: "Weight management",
    steps: [
      {
        key: "body",
        title: "Your height and weight",
        intro: "We use these to work out your body mass index (BMI).",
        questions: [
          { key: "height", label: "How tall are you?", kind: "number", required: true, unit: "cm", min: 120, max: 230 },
          { key: "weight", label: "How much do you weigh?", kind: "number", required: true, unit: "kg", min: 35, max: 350 },
        ],
      },
      {
        key: "health",
        title: "Your health",
        questions: [
          { key: "pregnant", label: "Are you pregnant, breastfeeding, or trying to get pregnant?", help: "If this doesn't apply to you, answer No.", kind: "yes_no", required: true },
          {
            key: "conditions",
            label: "Do you have any of these?",
            help: "Choose all that apply, or leave them all unticked.",
            kind: "multi_choice",
            required: false,
            options: [
              { value: "type2_diabetes", label: "Type 2 diabetes or prediabetes" },
              { value: "high_blood_pressure", label: "High blood pressure" },
              { value: "sleep_apnoea", label: "Sleep apnoea" },
            ],
          },
        ],
      },
      {
        key: "wellbeing",
        title: "Your wellbeing",
        questions: [
          {
            key: "harm",
            label: "Have you had thoughts of harming yourself?",
            kind: "single_choice",
            required: true,
            options: [
              { value: "never", label: "No" },
              { value: "past", label: "Yes, in the past" },
              { value: "now", label: "Yes, recently" },
            ],
          },
        ],
      },
      {
        key: "medicines",
        title: "Medicines and check-ups",
        questions: [
          { key: "medicines", label: "Which medicines do you take now?", help: "Include anything from a pharmacy or supermarket.", kind: "text", required: false },
          { key: "last_check_up", label: "When did you last see a GP?", kind: "date", required: false },
        ],
      },
    ],
    stops: [
      { when: (a) => a.pregnant === true, message: "The medicines in this program aren't safe during pregnancy or breastfeeding. Your GP can talk you through other options.", urgentHelp: false },
      { when: (a) => a.harm === "now", message: "We can't offer this program online at the moment. Please talk to someone today about how you're feeling.", urgentHelp: true },
    ],
  },
  {
    programId: SLEEP,
    brandId: KESTREL,
    tenantId: HARBOUR,
    name: "Sleep care (demo)",
    condition: "Sleep",
    steps: [
      {
        key: "sleep",
        title: "Your sleep",
        questions: [
          { key: "hours", label: "How many hours do you sleep on a usual night?", kind: "number", required: true, unit: "hours", min: 0, max: 24 },
          { key: "snore", label: "Has anyone told you that you snore?", kind: "yes_no", required: true },
        ],
      },
    ],
    stops: [],
  },
];

/**
 * Intakes by id. Before an account the token is an intake's only holder, as
 * its hash is the API's; a claim clears it and sets the owner, the patient
 * session that claimed it (patient-intake.mjs), so each sign-in starts afresh.
 */
export const intakes = new Map();

export function tenantOf(req, res, fail) {
  const tenantId = req.headers[TENANT_HEADER];
  if (typeof tenantId !== "string" || !UUID.test(tenantId)) {
    fail(res, 400, "tenant_required", `${TENANT_HEADER} must be a tenant id`);
    return null;
  }
  return tenantId;
}

/** Larkspur is paused and Coastal's tenant has no open program, as the API's accepting check says. */
export function acceptingRefusal(res, fail, brandId) {
  if (brandId !== KESTREL) {
    fail(res, 409, "brand_not_accepting", "This service isn't taking new patients right now");
    return true;
  }
  return false;
}

export function ageOn(dateOfBirth, today) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export const sydneyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

export function programById(programId) {
  return PROGRAMS.find((p) => p.programId === programId) ?? null;
}

/** The intake as the API shows it (`intakeView`). */
export function viewOf(intake) {
  const program = programById(intake.programId);
  const steps = program.steps.map((step, index) => ({ ...step, done: index < intake.stepsDone }));
  const inProgress = intake.status === "in_progress";
  const current = inProgress && intake.stepsDone < steps.length ? steps[intake.stepsDone].key : null;
  return {
    intakeId: intake.intakeId,
    programId: intake.programId,
    programName: program.name,
    status: intake.status,
    endedReason: intake.endedReason,
    steps,
    currentStep: current,
    answers: intake.answers,
    stop: intake.stop,
    readyToSubmit: inProgress && intake.stepsDone >= steps.length,
    startedAt: intake.startedAt,
    submittedAt: intake.submittedAt,
  };
}

/** Check one step's answers as the API does (readStepAnswers), and save them; a hard stop ends the intake. */
export function answerStep(res, fail, intake, stepKey, body) {
  if (!isObject(body) || Object.keys(body).join(",") !== "answers" || !isObject(body.answers)) return fail(res, 400, "bad_request", BAD_REQUEST);
  if (intake.status !== "in_progress") return fail(res, 409, "intake_closed", "This intake is finished. Start a new one to answer again.");
  const program = programById(intake.programId);
  const index = program.steps.findIndex((s) => s.key === stepKey);
  if (index < 0) return fail(res, 404, "not_found", "Step not found");
  if (index > intake.stepsDone) return fail(res, 409, "step_not_reached", "Answer the steps before this one first");
  const step = program.steps[index];
  const problems = [];
  const answers = {};
  for (const key of Object.keys(body.answers)) if (!step.questions.some((q) => q.key === key)) problems.push({ key, message: "That isn’t a question on this step" });
  for (const q of step.questions) {
    const value = body.answers[q.key];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (empty) {
      if (q.required) problems.push({ key: q.key, message: "Answer this question" });
      continue;
    }
    const options = new Set((q.options ?? []).map((o) => o.value));
    const ok =
      (q.kind === "yes_no" && typeof value === "boolean") ||
      (q.kind === "single_choice" && options.has(value)) ||
      (q.kind === "multi_choice" && Array.isArray(value) && value.every((v) => options.has(v))) ||
      (q.kind === "date" && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) ||
      (q.kind === "text" && typeof value === "string" && value.length <= 2000) ||
      (q.kind === "number" && typeof value === "number" && Number.isFinite(value));
    if (!ok) problems.push({ key: q.key, message: "Check this answer" });
    else if (q.kind === "number" && (value < q.min || value > q.max)) problems.push({ key: q.key, message: `Enter a number from ${q.min} to ${q.max}${q.unit ? ` ${q.unit}` : ""}` });
    else answers[q.key] = q.kind === "text" ? value.trim() : value;
  }
  if (problems.length > 0) return fail(res, 400, "answer_problems", "Check your answers", { problems });
  for (const q of step.questions) delete intake.answers[q.key];
  Object.assign(intake.answers, answers);
  intake.stepsDone = Math.max(intake.stepsDone, index + 1);
  const stop = program.stops.find((rule) => rule.when(intake.answers));
  if (stop) {
    intake.status = "ineligible";
    intake.stop = { message: stop.message, urgentHelp: stop.urgentHelp };
  }
  return true;
}

export function intakeRoutes({ send, fail, readJson }) {
  const held = (req, res, intakeId) => {
    const tenantId = tenantOf(req, res, fail);
    if (!tenantId) return null;
    const token = req.headers[TOKEN_HEADER];
    if (typeof token !== "string" || !token) {
      fail(res, 400, "intake_token_required", `Send the intake's resume token in ${TOKEN_HEADER}`);
      return null;
    }
    const intake = intakes.get(intakeId);
    if (!intake || intake.tenantId !== tenantId || intake.token !== token) {
      fail(res, 404, "not_found", "Intake not found");
      return null;
    }
    return intake;
  };

  return [
    [
      "GET",
      /^\/v1\/public\/brands\/([^/]+)\/programs$/,
      (req, res, [brandId]) => {
        const tenantId = tenantOf(req, res, fail);
        if (!tenantId) return;
        if (acceptingRefusal(res, fail, brandId)) return;
        const programs = PROGRAMS.filter((p) => p.brandId === brandId && p.tenantId === tenantId);
        send(res, 200, { programs: programs.map(({ programId, name, condition }) => ({ programId, name, condition })) });
      },
    ],
    [
      "GET",
      /^\/v1\/public\/programs\/([^/]+)\/intake-start$/,
      (req, res, [programId]) => {
        const tenantId = tenantOf(req, res, fail);
        if (!tenantId) return;
        const program = programById(programId);
        if (!program || program.tenantId !== tenantId) return fail(res, 404, "not_found", "Program not found");
        if (acceptingRefusal(res, fail, program.brandId)) return;
        const { documentId, version, title, body } = PRIVACY;
        send(res, 200, { programId, programName: program.name, privacyNotice: { documentId, version, title, body } });
      },
    ],
    [
      "POST",
      /^\/v1\/public\/intakes$/,
      async (req, res) => {
        const tenantId = tenantOf(req, res, fail);
        if (!tenantId) return;
        const body = await readJson(req);
        const keys = isObject(body) ? Object.keys(body).sort().join(",") : "";
        if (keys !== "adult,dateOfBirth,privacyDocumentId,programId" || body.adult !== true || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) {
          return fail(res, 400, "bad_request", BAD_REQUEST);
        }
        const program = programById(body.programId);
        if (!program || program.tenantId !== tenantId) return fail(res, 404, "not_found", "Program not found");
        if (acceptingRefusal(res, fail, program.brandId)) return;
        if (body.privacyDocumentId !== PRIVACY.documentId) return fail(res, 409, "not_current_version", "The privacy notice has changed. Read the new one and agree to it.");
        const underAge = ageOn(body.dateOfBirth, sydneyToday()) < 18;
        const intake = {
          intakeId: randomUUID(),
          tenantId,
          programId: program.programId,
          token: randomBytes(32).toString("base64url"),
          owner: null,
          dateOfBirth: body.dateOfBirth,
          status: underAge ? "ended" : "in_progress",
          endedReason: underAge ? "under_age" : null,
          stepsDone: 0,
          answers: {},
          stop: null,
          startedAt: new Date().toISOString(),
          submittedAt: null,
        };
        intakes.set(intake.intakeId, intake);
        send(res, 201, viewOf(intake), { [TOKEN_HEADER]: intake.token });
      },
    ],
    [
      "GET",
      /^\/v1\/public\/intakes\/([^/]+)$/,
      (req, res, [intakeId]) => {
        const intake = held(req, res, intakeId);
        if (intake) send(res, 200, viewOf(intake));
      },
    ],
    [
      "PUT",
      /^\/v1\/public\/intakes\/([^/]+)\/steps\/([^/]+)$/,
      async (req, res, [intakeId, stepKey]) => {
        const intake = held(req, res, intakeId);
        if (!intake) return;
        const body = await readJson(req);
        if (answerStep(res, fail, intake, stepKey, body) === true) send(res, 200, viewOf(intake));
      },
    ],
  ];
}
