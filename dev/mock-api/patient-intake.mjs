/**
 * The mock API's routes for a person becoming a patient and finishing an
 * intake, in the API's shapes and with its checks and error codes
 * (docs/decisions/patients.md IDN3, IDN12 to IDN20 and intake.md INT6,
 * INT12 and INT17 in medora-backend): creating the account through a brand,
 * the care consents, claiming what a browser started, and the patient's own
 * intakes up to sending one to a clinician.
 *
 * Every patient intake belongs to the session that claimed or started it,
 * so tests side by side, and each sign-in, start afresh.
 */
import { randomUUID } from "node:crypto";
import { agree, careConsentsNeeded, consentStates, PRIVACY } from "./consents.mjs";
import { BAD_REQUEST, isObject } from "./http.mjs";
import { acceptingRefusal, ageOn, answerStep, intakes, programById, sydneyToday, viewOf } from "./intake.mjs";
import { accounts, confirmSession, patientOf } from "./patient.mjs";

const SEXES = new Set(["female", "male", "intersex", "not_stated"]);
const ACCOUNT_KEYS = new Set(["brandId", "givenName", "familyName", "preferredName", "dateOfBirth", "sex", "email", "mobile"]);
const name = (value) => typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 100;

/** A made-up new patient, from what they typed. Their email stands in for the sign-in's. */
function newPatient(body) {
  const givenName = body.givenName.trim();
  const familyName = body.familyName.trim();
  const preferredName = typeof body.preferredName === "string" ? body.preferredName.trim() : null;
  const digits = typeof body.mobile === "string" ? body.mobile.replace(/[\s\-()]/g, "") : null;
  return {
    patientId: randomUUID(),
    givenName,
    familyName,
    preferredName,
    displayName: `${preferredName ?? givenName} ${familyName}`,
    dateOfBirth: body.dateOfBirth,
    sex: body.sex,
    timeZone: null,
    identityStatus: "unverified",
    email: "new.patient@example.test",
    mobile: digits ? `+61${digits.slice(1)}` : null,
    address: null,
    medicare: null,
    createdAt: new Date().toISOString(),
    programs: [],
  };
}

const mine = (intake, patient) => intake.owner === patient.session && intake.tenantId === patient.tenantId;

export function patientIntakeRoutes({ send, fail, readJson }) {
  /** The patient's own intake by id, with the API's date of birth check (INT17), or a reply already sent. */
  const ownIntake = (req, res, intakeId) => {
    const patient = patientOf(req, res, fail, "patient");
    if (!patient) return null;
    const intake = intakes.get(intakeId);
    if (!intake || !mine(intake, patient)) {
      fail(res, 404, "not_found", "Intake not found");
      return null;
    }
    if (intake.dateOfBirth !== patient.record.dateOfBirth) {
      fail(res, 409, "date_of_birth_differs", "This intake was started with a different date of birth, so it can't be shown. Start a new one.");
      return null;
    }
    return { patient, intake };
  };

  const consentRefusal = (res, patient) => {
    const kinds = careConsentsNeeded(patient.session);
    if (kinds.length === 0) return false;
    fail(res, 409, "consent_needed", "Read and agree to the latest terms to carry on", { kinds });
    return true;
  };

  return [
    [
      "POST",
      /^\/v1\/patient\/account$/,
      async (req, res) => {
        const patient = patientOf(req, res, fail, "patient-sign-in");
        if (!patient) return;
        if (patient.record) return fail(res, 409, "already_registered", "You already have an account here. Sign in instead.");
        const body = await readJson(req);
        const keys = isObject(body) ? Object.keys(body) : [];
        const shaped =
          keys.every((key) => ACCOUNT_KEYS.has(key)) &&
          typeof body.brandId === "string" &&
          name(body.givenName) &&
          name(body.familyName) &&
          (body.preferredName === undefined || body.preferredName === null || name(body.preferredName)) &&
          typeof body.dateOfBirth === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth) &&
          SEXES.has(body.sex) &&
          (body.mobile === undefined || typeof body.mobile === "string");
        if (!shaped) return fail(res, 400, "bad_request", BAD_REQUEST);
        if (acceptingRefusal(res, fail, body.brandId)) return;
        const today = sydneyToday();
        if (body.dateOfBirth > today) return fail(res, 400, "date_of_birth", "Your date of birth can't be in the future");
        const age = ageOn(body.dateOfBirth, today);
        if (age > 120) return fail(res, 400, "date_of_birth", "Check the year of your date of birth");
        if (age < 18) return fail(res, 400, "under_age", "This service is for adults 18 and over");
        if (body.mobile !== undefined && !/^04\d{8}$/.test(body.mobile.replace(/[\s\-()]/g, ""))) {
          return fail(res, 400, "mobile", "Enter an Australian mobile number, like 0412 345 678");
        }
        const record = newPatient(body);
        accounts.set(patient.session, record);
        confirmSession(patient.session);
        send(res, 201, { ...record, consentsNeeded: careConsentsNeeded(patient.session) });
      },
    ],
    [
      "GET",
      /^\/v1\/patient\/consents$/,
      (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (patient) send(res, 200, { consents: consentStates(patient.session) });
      },
    ],
    [
      "POST",
      /^\/v1\/patient\/consents$/,
      async (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (!patient) return;
        const body = await readJson(req);
        if (!isObject(body) || Object.keys(body).join(",") !== "documentId" || typeof body.documentId !== "string") return fail(res, 400, "bad_request", BAD_REQUEST);
        const consents = agree(patient.session, body.documentId);
        if (!consents) return fail(res, 409, "not_current_version", "That isn't the current version. Read the new one and agree to it.");
        send(res, 200, { consents });
      },
    ],
    [
      "POST",
      /^\/v1\/patient\/intakes\/claim$/,
      async (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (!patient) return;
        const body = await readJson(req);
        const tokens = isObject(body) && Object.keys(body).join(",") === "tokens" && Array.isArray(body.tokens) ? body.tokens : null;
        if (!tokens || tokens.length < 1 || tokens.length > 20 || !tokens.every((t) => typeof t === "string" && t.length >= 20 && t.length <= 100)) {
          return fail(res, 400, "bad_request", BAD_REQUEST);
        }
        const claimed = [];
        for (const intake of intakes.values()) {
          if (intake.tenantId !== patient.tenantId || intake.owner !== null || !tokens.includes(intake.token)) continue;
          intake.owner = patient.session;
          intake.token = null;
          claimed.push(intake.intakeId);
        }
        // Each claimed intake brings the privacy notice it was started under (INT6).
        if (claimed.length > 0) agree(patient.session, PRIVACY.documentId);
        send(res, 200, { claimed });
      },
    ],
    [
      "GET",
      /^\/v1\/patient\/intakes$/,
      (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (!patient) return;
        const list = [...intakes.values()]
          .filter((intake) => mine(intake, patient))
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .map((intake) => ({
            intakeId: intake.intakeId,
            programId: intake.programId,
            programName: programById(intake.programId).name,
            status: intake.status,
            endedReason: intake.endedReason,
            startedAt: intake.startedAt,
            submittedAt: intake.submittedAt,
            endedAt: intake.endedAt ?? null,
          }));
        send(res, 200, { intakes: list });
      },
    ],
    [
      "POST",
      /^\/v1\/patient\/intakes$/,
      async (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (!patient) return;
        const body = await readJson(req);
        if (!isObject(body) || Object.keys(body).join(",") !== "programId" || typeof body.programId !== "string") return fail(res, 400, "bad_request", BAD_REQUEST);
        const program = programById(body.programId);
        if (!program || program.tenantId !== patient.tenantId) return fail(res, 404, "not_found", "Program not found");
        if (acceptingRefusal(res, fail, program.brandId)) return;
        if (consentRefusal(res, patient)) return;
        // One in progress for the same program, started with the patient's own date of birth, is picked up (INT12, INT17).
        const open = [...intakes.values()]
          .filter((i) => mine(i, patient) && i.programId === program.programId && i.status === "in_progress" && i.dateOfBirth === patient.record.dateOfBirth)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
        if (open) return send(res, 201, viewOf(open));
        const intake = {
          intakeId: randomUUID(),
          tenantId: patient.tenantId,
          programId: program.programId,
          token: null,
          owner: patient.session,
          dateOfBirth: patient.record.dateOfBirth,
          status: "in_progress",
          endedReason: null,
          stepsDone: 0,
          answers: {},
          stop: null,
          startedAt: new Date().toISOString(),
          submittedAt: null,
        };
        intakes.set(intake.intakeId, intake);
        send(res, 201, viewOf(intake));
      },
    ],
    [
      "GET",
      /^\/v1\/patient\/intakes\/([^/]+)$/,
      (req, res, [intakeId]) => {
        const own = ownIntake(req, res, intakeId);
        if (own) send(res, 200, viewOf(own.intake));
      },
    ],
    [
      "PUT",
      /^\/v1\/patient\/intakes\/([^/]+)\/steps\/([^/]+)$/,
      async (req, res, [intakeId, stepKey]) => {
        const own = ownIntake(req, res, intakeId);
        if (!own) return;
        const body = await readJson(req);
        if (answerStep(res, fail, own.intake, stepKey, body) === true) send(res, 200, viewOf(own.intake));
      },
    ],
    [
      "POST",
      /^\/v1\/patient\/intakes\/([^/]+)\/submit$/,
      (req, res, [intakeId]) => {
        const own = ownIntake(req, res, intakeId);
        if (!own) return;
        const { patient, intake } = own;
        if (intake.status !== "in_progress") return fail(res, 409, "intake_closed", "This intake is finished. Start a new one to answer again.");
        if (consentRefusal(res, patient)) return;
        const steps = programById(intake.programId).steps;
        if (intake.stepsDone < steps.length) {
          return fail(res, 409, "intake_unfinished", "Answer every step before you send it", { step: steps[intake.stepsDone].key });
        }
        intake.status = "completed";
        intake.submittedAt = new Date().toISOString();
        send(res, 200, viewOf(intake));
      },
    ],
  ];
}
