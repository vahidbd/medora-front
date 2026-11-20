/**
 * The mock API's tracking routes, in the API's shapes and with its checks
 * and error codes (docs/decisions/tracking.md in medora-backend):
 * GET/POST /v1/patient/measurements, /v1/patient/side-effects and
 * /v1/patient/check-ins.
 *
 * Each preview sign-in starts from the same made-up history, so browser
 * tests running side by side never see each other's writes. Jamie's
 * history at Kestrel: four weekly weights, two waists and a check-in a
 * week ago, so a check-in is due today.
 */
import { randomUUID } from "node:crypto";
import { HARBOUR, patientOf } from "./patient.mjs";

const DAY = 86_400_000;
const KINDS = {
  weight: { unit: "kg", min: 20, max: 400 },
  waist: { unit: "cm", min: 30, max: 300 },
  height: { unit: "cm", min: 50, max: 250 },
  blood_pressure_systolic: { unit: "mmHg", min: 50, max: 260 },
  blood_pressure_diastolic: { unit: "mmHg", min: 30, max: 160 },
  heart_rate: { unit: "bpm", min: 25, max: 250 },
};
const SEVERITIES = ["mild", "moderate", "severe"];
const MISSED_DOSES = ["none", "some", "most"];

const histories = new Map();

function measurement(kind, value, measuredAt, checkInId = null) {
  return { measurementId: randomUUID(), kind, value, unit: KINDS[kind].unit, measuredAt, recordedBy: "patient", checkInId };
}

function seeded(tenantId) {
  if (tenantId !== HARBOUR) return { measurements: [], sideEffects: [], checkIns: [] };
  const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
  const checkInId = randomUUID();
  const weekAgo = measurement("weight", 91.8, ago(7), checkInId);
  return {
    measurements: [weekAgo, measurement("waist", 102.5, ago(14)), measurement("weight", 92.6, ago(14)), measurement("weight", 93.1, ago(21)), measurement("waist", 104, ago(28)), measurement("weight", 94, ago(28))],
    sideEffects: [],
    checkIns: [{ checkInId, missedDoses: "none", feeling: 4, submittedAt: ago(7), measurementIds: [weekAgo.measurementId], sideEffectId: null }],
  };
}

function historyOf(patient) {
  if (!histories.has(patient.session)) histories.set(patient.session, seeded(patient.tenantId));
  return histories.get(patient.session);
}

class Refusal extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const badShape = () => new Refusal("bad_request", "Some of what was sent is missing or not in the right form");

function checkReadings(readings, measuredAt) {
  if (!Array.isArray(readings) || readings.length === 0 || readings.length > 6) throw badShape();
  for (const r of readings) if (!isObject(r) || !KINDS[r.kind] || typeof r.value !== "number" || !Number.isFinite(r.value)) throw badShape();
  const kinds = readings.map((r) => r.kind);
  if (new Set(kinds).size !== kinds.length) throw new Refusal("duplicate_kind", "Send each kind of measurement once");
  for (const r of readings) {
    const { min, max, unit } = KINDS[r.kind];
    if (r.value < min || r.value > max) throw new Refusal("out_of_range", `That ${r.kind.replace(/_/g, " ")} doesn't look right: enter it in ${unit}`);
  }
  const systolic = readings.find((r) => r.kind === "blood_pressure_systolic");
  const diastolic = readings.find((r) => r.kind === "blood_pressure_diastolic");
  if (Boolean(systolic) !== Boolean(diastolic)) throw new Refusal("blood_pressure_pair", "Blood pressure needs both numbers");
  if (systolic && diastolic && systolic.value <= diastolic.value) throw new Refusal("blood_pressure_order", "The first blood pressure number is the higher one");
  if (measuredAt > Date.now() + 5 * 60_000) throw new Refusal("measured_in_future", "A reading can't be in the future");
  if (measuredAt < Date.now() - 30 * DAY) throw new Refusal("measured_too_long_ago", "A reading can be at most 30 days old");
}

function checkSideEffect(body) {
  if (!isObject(body) || !SEVERITIES.includes(body.severity) || typeof body.description !== "string") throw badShape();
  const description = body.description.trim();
  if (description.length < 1 || description.length > 2000) throw badShape();
  const startedOn = body.startedOn ?? null;
  if (startedOn !== null) {
    if (typeof startedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) throw badShape();
    const parsed = new Date(`${startedOn}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== startedOn) throw new Refusal("started_on", "That date is not real");
    if (parsed.getTime() > Date.now() + DAY) throw new Refusal("started_on", "The start date can't be in the future");
    if (Date.now() - parsed.getTime() > 732 * DAY) throw new Refusal("started_on", "That start date is too long ago");
  }
  return { severity: body.severity, description, startedOn };
}

function sideEffect(input, checkInId = null) {
  return { sideEffectId: randomUUID(), ...input, reportedAt: new Date().toISOString(), reportedBy: "patient", checkInId };
}

function checkInReply(history, row) {
  return {
    checkInId: row.checkInId,
    missedDoses: row.missedDoses,
    feeling: row.feeling,
    submittedAt: row.submittedAt,
    measurements: history.measurements.filter((m) => m.checkInId === row.checkInId),
    sideEffect: history.sideEffects.find((s) => s.sideEffectId === row.sideEffectId) ?? null,
  };
}

const newestFirst = (field) => (a, b) => b[field].localeCompare(a[field]);

/** The routes, in the server's [method, pattern, handler] shape. */
export function trackingRoutes({ send, fail, readJson }) {
  /** Runs a patient route, turning a refusal into the API's 400. */
  const route = (handler) => async (req, res) => {
    const patient = patientOf(req, res, fail, "patient");
    if (!patient) return;
    try {
      await handler(req, res, historyOf(patient));
    } catch (error) {
      if (error instanceof Refusal) return fail(res, 400, error.code, error.message);
      throw error;
    }
  };
  return [
    ["GET", /^\/v1\/patient\/measurements$/, route((req, res, history) => send(res, 200, { measurements: [...history.measurements].sort(newestFirst("measuredAt")) }))],
    [
      "POST",
      /^\/v1\/patient\/measurements$/,
      route(async (req, res, history) => {
        const body = await readJson(req);
        if (!isObject(body)) throw badShape();
        const measuredAt = body.measuredAt === undefined ? new Date() : new Date(body.measuredAt);
        if (Number.isNaN(measuredAt.getTime())) throw badShape();
        checkReadings(body.readings, measuredAt.getTime());
        const rows = body.readings.map((r) => measurement(r.kind, r.value, measuredAt.toISOString()));
        history.measurements.push(...rows);
        send(res, 201, { measurements: rows });
      }),
    ],
    ["GET", /^\/v1\/patient\/side-effects$/, route((req, res, history) => send(res, 200, { sideEffects: [...history.sideEffects].sort(newestFirst("reportedAt")) }))],
    [
      "POST",
      /^\/v1\/patient\/side-effects$/,
      route(async (req, res, history) => {
        const row = sideEffect(checkSideEffect(await readJson(req)));
        history.sideEffects.push(row);
        send(res, 201, row);
      }),
    ],
    [
      "GET",
      /^\/v1\/patient\/check-ins$/,
      route((req, res, history) => send(res, 200, { checkIns: [...history.checkIns].sort(newestFirst("submittedAt")).map((row) => checkInReply(history, row)) })),
    ],
    [
      "POST",
      /^\/v1\/patient\/check-ins$/,
      route(async (req, res, history) => {
        const body = await readJson(req);
        if (!isObject(body) || !MISSED_DOSES.includes(body.missedDoses) || !Number.isInteger(body.feeling) || body.feeling < 1 || body.feeling > 5) throw badShape();
        const now = new Date();
        if (body.readings?.length) checkReadings(body.readings, now.getTime());
        const effect = body.sideEffect ? checkSideEffect(body.sideEffect) : null;
        const checkInId = randomUUID();
        const rows = (body.readings ?? []).map((r) => measurement(r.kind, r.value, now.toISOString(), checkInId));
        const reported = effect ? sideEffect(effect, checkInId) : null;
        history.measurements.push(...rows);
        if (reported) history.sideEffects.push(reported);
        const row = { checkInId, missedDoses: body.missedDoses, feeling: body.feeling, submittedAt: now.toISOString(), sideEffectId: reported?.sideEffectId ?? null };
        history.checkIns.push(row);
        send(res, 201, checkInReply(history, row));
      }),
    ],
  ];
}
