/**
 * The mock API's adherence routes, in the API's shapes (docs/decisions/adherence.md
 * in medora-backend):
 *
 * - POST /v1/patient/activity/app-opened, which the patient app calls each
 *   time the signed-in frame loads. The API counts one a day; the mock only
 *   answers with the day it would count.
 * - The care team's adherence flags: the list, one flag, resolve and
 *   reopen, and GET /v1/side-effects/:id for the patient's words. Seeded
 *   with made-up patients and reports, held in memory like the rest.
 */
import { BAD_REQUEST, isObject } from "./http.mjs";
import { patientOf } from "./patient.mjs";
import { daysFromNow, ME, memberships, newId, TENANTS } from "./people.mjs";
import { tenantOf } from "./staff.mjs";

const [harbour, coastal] = TENANTS.map((t) => t.tenantId);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URGENCY_ORDER = { urgent: 0, soon: 1, routine: 2 };
const OUTCOMES = ["contacted_patient", "booked_review", "referred_to_prescriber", "no_action_needed"];
const HOUR = 1 / 24;

const dayIn = (timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const staffName = (tenantId, userId) => memberships.find((m) => m.tenantId === tenantId && m.userId === userId)?.displayName ?? null;
const taylor = memberships.find((m) => m.email === "taylor.reid@example.test").userId;

/** Made-up patients and what they reported. */
const sideEffects = [];
const flags = [];

function seed(tenantId, patientName, report, flag) {
  const patientId = newId("60000000");
  const sideEffectId = newId("61000000");
  sideEffects.push({
    tenantId,
    sideEffectId,
    patientId,
    severity: report.severity,
    description: report.description,
    startedOn: report.startedOn ?? null,
    reportedAt: flag.raisedAt,
    reportedBy: report.reportedBy ?? "patient",
    checkInId: null,
  });
  flags.push({
    tenantId,
    adherenceFlagId: newId("62000000"),
    patientId,
    patientName,
    kind: "side_effect_reported",
    urgency: report.severity === "severe" ? "urgent" : "soon",
    sideEffectId,
    reopenedFromId: null,
    raisedAt: flag.raisedAt,
    status: flag.resolution ? "resolved" : "open",
    resolution: flag.resolution ?? null,
  });
}

seed(
  coastal,
  "Charlie Rivers",
  { severity: "severe", description: "Vomiting since last night and I can't keep water down." },
  { raisedAt: daysFromNow(-3 * HOUR) },
);
seed(
  coastal,
  "Dana Fox",
  { severity: "severe", description: "Sharp pain high in my stomach that goes through to my back.", startedOn: dayIn("Australia/Brisbane") },
  { raisedAt: daysFromNow(-1) },
);
seed(coastal, "Eli Stone", { severity: "moderate", description: "Feeling sick most mornings for the past week." }, { raisedAt: daysFromNow(-2) });
seed(
  coastal,
  "Frankie Moss",
  { severity: "moderate", description: "Constipated for five days. Said so on a call with the nurse.", reportedBy: "care_team" },
  { raisedAt: daysFromNow(-3) },
);
seed(
  coastal,
  "Gale Turner",
  { severity: "moderate", description: "Dizzy when I stand up, mostly in the afternoon." },
  {
    raisedAt: daysFromNow(-6),
    resolution: { outcome: "booked_review", resolvedAt: daysFromNow(-5), resolvedBy: taylor, note: "Booked a video review for Thursday." },
  },
);
seed(
  coastal,
  "Harper Lane",
  { severity: "severe", description: "Rash on my arms and chest since the second dose." },
  { raisedAt: daysFromNow(-9), resolution: { outcome: "contacted_patient", resolvedAt: daysFromNow(-9 + 2 * HOUR), resolvedBy: ME.userId, note: null } },
);
seed(harbour, "Indigo Park", { severity: "severe", description: "Heart racing on and off since this morning." }, { raisedAt: daysFromNow(-5 * HOUR) });
seed(harbour, "Jules Carter", { severity: "moderate", description: "Headaches every afternoon this week." }, { raisedAt: daysFromNow(-4) });

const resolutionOf = (flag, withNote) => {
  if (!flag.resolution) return null;
  const { outcome, resolvedAt, resolvedBy, note } = flag.resolution;
  const reply = { outcome, resolvedAt, resolvedBy: { userId: resolvedBy, displayName: staffName(flag.tenantId, resolvedBy) } };
  return withNote ? { ...reply, note } : reply;
};

const summaryOf = (flag) => ({
  adherenceFlagId: flag.adherenceFlagId,
  patientId: flag.patientId,
  patientName: flag.patientName,
  kind: flag.kind,
  urgency: flag.urgency,
  sideEffectId: flag.sideEffectId,
  reopenedFromId: flag.reopenedFromId,
  raisedAt: flag.raisedAt,
  status: flag.status,
  resolution: resolutionOf(flag, false),
});

function detailOf(flag) {
  const earlier = flags.find((f) => f.adherenceFlagId === flag.reopenedFromId);
  const later = flags.find((f) => f.reopenedFromId === flag.adherenceFlagId);
  return {
    ...summaryOf(flag),
    resolution: resolutionOf(flag, true),
    reopenedFrom: earlier ? resolutionOf(earlier, true) : null,
    reopenedAsId: later ? later.adherenceFlagId : null,
  };
}

const byOrder = (status) =>
  status === "open"
    ? (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || Date.parse(a.raisedAt) - Date.parse(b.raisedAt)
    : (a, b) => Date.parse(b.resolution.resolvedAt) - Date.parse(a.resolution.resolvedAt);

function flagIn(res, fail, tenantId, id) {
  const flag = UUID.test(id) ? flags.find((f) => f.tenantId === tenantId && f.adherenceFlagId === id.toLowerCase()) : undefined;
  if (!flag) fail(res, 404, "not_found", "Adherence flag not found");
  return flag;
}

/** The routes, in the server's [method, pattern, handler] shape. */
export function adherenceRoutes({ send, fail, readJson }) {
  return [
    [
      "POST",
      /^\/v1\/patient\/activity\/app-opened$/,
      (req, res) => {
        if (!patientOf(req, res, fail, "patient")) return;
        send(res, 200, { openedOn: dayIn("Australia/Sydney") });
      },
    ],
    [
      "GET",
      /^\/v1\/adherence\/flags$/,
      (req, res) => {
        const mine = tenantOf(req, res, "adherence:read");
        if (!mine) return;
        const query = new URL(req.url, "http://mock").searchParams;
        const status = query.get("status") ?? "open";
        const limit = Number(query.get("limit") ?? 100);
        if (!["open", "resolved"].includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 200) {
          return fail(res, 400, "bad_request", BAD_REQUEST);
        }
        const rows = flags.filter((f) => f.tenantId === mine.tenantId && f.status === status).sort(byOrder(status));
        send(res, 200, { adherenceFlags: rows.slice(0, limit).map(summaryOf) });
      },
    ],
    [
      "GET",
      /^\/v1\/adherence\/flags\/([^/]+)$/,
      (req, res, [id]) => {
        const mine = tenantOf(req, res, "adherence:read");
        if (!mine) return;
        const flag = flagIn(res, fail, mine.tenantId, id);
        if (flag) send(res, 200, detailOf(flag));
      },
    ],
    [
      "POST",
      /^\/v1\/adherence\/flags\/([^/]+)\/resolve$/,
      async (req, res, [id]) => {
        const mine = tenantOf(req, res, "adherence:resolve");
        if (!mine) return;
        const body = await readJson(req);
        const note = isObject(body) && typeof body.note === "string" ? body.note.trim() : null;
        const valid =
          isObject(body) &&
          Object.keys(body).every((k) => ["outcome", "note"].includes(k)) &&
          OUTCOMES.includes(body.outcome) &&
          (body.note === undefined || body.note === null || (typeof body.note === "string" && note.length <= 1000));
        if (!valid) return fail(res, 400, "bad_request", BAD_REQUEST);
        const flag = flagIn(res, fail, mine.tenantId, id);
        if (!flag) return;
        if (flag.status !== "open") return fail(res, 409, "already_resolved", "This adherence flag is already resolved");
        flag.status = "resolved";
        flag.resolution = { outcome: body.outcome, resolvedAt: new Date().toISOString(), resolvedBy: ME.userId, note: note || null };
        send(res, 200, detailOf(flag));
      },
    ],
    [
      "POST",
      /^\/v1\/adherence\/flags\/([^/]+)\/reopen$/,
      (req, res, [id]) => {
        const mine = tenantOf(req, res, "adherence:resolve");
        if (!mine) return;
        const earlier = flagIn(res, fail, mine.tenantId, id);
        if (!earlier) return;
        if (earlier.status !== "resolved") return fail(res, 409, "not_resolved", "Only a resolved adherence flag can be reopened");
        if (flags.some((f) => f.reopenedFromId === earlier.adherenceFlagId)) {
          return fail(res, 409, "already_reopened", "This adherence flag was reopened already");
        }
        const flag = {
          ...earlier,
          adherenceFlagId: newId("62000000"),
          reopenedFromId: earlier.adherenceFlagId,
          raisedAt: new Date().toISOString(),
          status: "open",
          resolution: null,
        };
        flags.push(flag);
        send(res, 201, detailOf(flag));
      },
    ],
    [
      "GET",
      /^\/v1\/side-effects\/([^/]+)$/,
      (req, res, [id]) => {
        const mine = tenantOf(req, res, "adherence:read");
        if (!mine) return;
        const row = sideEffects.find((s) => s.tenantId === mine.tenantId && s.sideEffectId === id.toLowerCase());
        if (!row) return fail(res, 404, "not_found", "Side effect not found");
        const { sideEffectId, patientId, severity, description, startedOn, reportedAt, reportedBy, checkInId } = row;
        send(res, 200, { sideEffectId, patientId, severity, description, startedOn, reportedAt, reportedBy, checkInId });
      },
    ],
  ];
}
