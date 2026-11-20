/**
 * The mock API's clinicians: made-up clinicians, credentials, hours and
 * time off, answering in the API's shapes (GET and POST /v1/clinicians and
 * what hangs off one). Standing is worked out the way the API does it
 * (src/modules/clinicians/standing.ts in the backend), with fewer edge cases.
 */
import { randomUUID } from "node:crypto";

const DAY_MS = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days) => new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
const ago = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

function credential(kind, fields) {
  return {
    credentialId: randomUUID(),
    kind,
    reference: null,
    registeringBody: null,
    registrationType: null,
    registrationStatus: null,
    conditions: null,
    endorsement: null,
    insurer: null,
    coversTelehealthNewPatients: null,
    startsOn: null,
    expiresOn: null,
    verifiedAt: null,
    conditionsReviewedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    createdAt: ago(20),
    ...fields,
  };
}
const registration = (reference, verified) =>
  credential("registration", { reference, registeringBody: "ahpra", registrationType: "general", registrationStatus: "practising", expiresOn: inDays(300), verifiedAt: verified ? ago(10) : null });
const indemnity = (verified) => credential("indemnity", { insurer: "Example Mutual", reference: "POL-0001", coversTelehealthNewPatients: true, expiresOn: inDays(200), verifiedAt: verified ? ago(10) : null });
const weekdays = (startsAt, endsAt) => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt, endsAt, slotMinutes: 15 }));

function newest(list) {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function counting(credentials, kind) {
  const held = credentials.filter((c) => c.kind === kind && !c.withdrawnAt);
  return { verified: newest(held.filter((c) => c.verifiedAt)), anyHeld: held.length > 0 };
}

function standingOf(clinician, membershipActive) {
  const reasons = [];
  const warnings = new Set();
  const now = today();
  if (!membershipActive) reasons.push("membership_inactive");
  if (clinician.suspension) reasons.push("suspended");
  const soon = inDays(30);
  const watch = (c) => c.expiresOn && c.expiresOn >= now && c.expiresOn <= soon && warnings.add("expires_soon");
  if (clinician.profession !== "health_coach") {
    const { verified, anyHeld } = counting(clinician.credentials, "registration");
    if (!verified) reasons.push(anyHeld ? "registration_unverified" : "registration_missing");
    else if (verified.expiresOn < now) reasons.push("registration_expired");
    else {
      if (verified.registrationStatus !== "practising") reasons.push("registration_not_practising");
      if (verified.conditions && !verified.conditionsReviewedAt) reasons.push("registration_conditions_unreviewed");
      watch(verified);
      if (Date.now() - Date.parse(verified.verifiedAt) > 31 * DAY_MS) warnings.add("recheck_due");
    }
  }
  const cover = counting(clinician.credentials, "indemnity");
  if (!cover.verified) reasons.push(cover.anyHeld ? "indemnity_unverified" : "indemnity_missing");
  else if (cover.verified.expiresOn < now) reasons.push("indemnity_expired");
  else if (!cover.verified.coversTelehealthNewPatients) reasons.push("indemnity_excludes_telehealth");
  else watch(cover.verified);
  const mayConsult = reasons.length === 0;
  const prescribing = [];
  if (!["medical_practitioner", "nurse_practitioner"].includes(clinician.profession)) prescribing.push("not_a_prescriber");
  else if (clinician.profession === "nurse_practitioner") {
    const endorsement = counting(clinician.credentials, "endorsement");
    if (!endorsement.verified) prescribing.push(endorsement.anyHeld ? "endorsement_unverified" : "endorsement_missing");
    else if (endorsement.verified.expiresOn && endorsement.verified.expiresOn < now) prescribing.push("endorsement_expired");
  }
  return { mayConsult, mayPrescribe: mayConsult && prescribing.length === 0, reasons: [...reasons, ...prescribing], warnings: [...warnings] };
}

export function clinicianRoutes({ send, fail, readJson, tenantOf, requirePermission, memberships, ME, ROLE_PERMISSIONS }) {
  const byEmail = (email) => memberships.find((m) => m.email === email);
  const clinicians = [
    { member: byEmail("sam.lee@example.test"), profession: "medical_practitioner", timeZone: "Australia/Sydney", credentials: [registration("MED0000000101", true), indemnity(true)], hours: weekdays("09:00", "17:00") },
    { member: byEmail("jordan.patel@example.test"), profession: "nurse_practitioner", timeZone: "Australia/Perth", credentials: [registration("NMW0000000102", true), indemnity(false)], hours: [] },
    { member: memberships.find((m) => m.userId === ME.userId && m.role === "clinician"), profession: "medical_practitioner", timeZone: "Australia/Melbourne", credentials: [registration("MED0000000103", true), indemnity(true)], hours: weekdays("08:00", "12:00") },
  ].map(({ member, ...rest }) => ({ clinicianId: randomUUID(), membershipId: member.membershipId, suspension: null, timeOff: [], ...rest }));

  const memberOf = (c) => memberships.find((m) => m.membershipId === c.membershipId);
  const summary = (c) => {
    const m = memberOf(c);
    return { clinicianId: c.clinicianId, membershipId: c.membershipId, userId: m.userId, email: m.email, profession: c.profession, timeZone: c.timeZone, suspension: c.suspension, standing: standingOf(c, m.status === "active") };
  };
  const countingIds = (c) => new Set(["registration", "endorsement", "indemnity"].map((kind) => counting(c.credentials, kind).verified?.credentialId).filter(Boolean));
  const detail = (c, mine) => {
    const isSelf = memberOf(c).userId === ME.userId;
    const counts = countingIds(c);
    const manages = ROLE_PERMISSIONS[mine.role].includes("clinicians:manage");
    return {
      ...summary(c),
      credentials: manages || isSelf ? [...c.credentials].reverse().map((cr) => ({ ...cr, counts: counts.has(cr.credentialId) })) : null,
      hours: [...c.hours].sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt)),
      timeOff: c.timeOff.filter((t) => t.endsAt > new Date().toISOString()),
    };
  };

  /** The tenant, the clinician in it, and who is acting; or a reply already sent. */
  function scope(req, res, clinicianId) {
    const mine = tenantOf(req, res);
    if (!mine || !requirePermission(res, mine, "clinicians:read")) return null;
    const c = clinicians.find((x) => x.clinicianId === clinicianId && memberOf(x).tenantId === mine.tenantId);
    if (!c) {
      fail(res, 404, "not_found", "Clinician not found");
      return null;
    }
    const isSelf = memberOf(c).userId === ME.userId;
    const manages = ROLE_PERMISSIONS[mine.role].includes("clinicians:manage");
    return { mine, c, isSelf, manages };
  }
  const selfOrManager = (res, s) => (s.manages || s.isSelf ? true : (fail(res, 403, "forbidden", "You don't have permission to do that"), false));
  const managerOfAnother = (res, s, what) => {
    if (!s.manages) return fail(res, 403, "forbidden", "You don't have permission to do that"), false;
    if (s.isSelf) return fail(res, 403, "own_record", `Someone else has to ${what} for you`), false;
    return true;
  };
  const bad = (res) => fail(res, 400, "bad_request", "Some of what was sent is missing or not in the right form");

  return [
    ["GET", /^\/v1\/clinicians$/, (req, res) => {
      const mine = tenantOf(req, res);
      if (!mine || !requirePermission(res, mine, "clinicians:read")) return;
      send(res, 200, { clinicians: clinicians.filter((c) => memberOf(c).tenantId === mine.tenantId).map(summary).sort((a, b) => a.email.localeCompare(b.email)) });
    }],
    ["POST", /^\/v1\/clinicians$/, async (req, res) => {
      const mine = tenantOf(req, res);
      if (!mine || !requirePermission(res, mine, "clinicians:manage")) return;
      const body = await readJson(req);
      const member = memberships.find((m) => m.tenantId === mine.tenantId && m.membershipId === body?.membershipId);
      if (!body?.profession || !body?.timeZone) return bad(res);
      if (!member) return fail(res, 404, "not_found", "Staff member not found");
      if (member.status !== "active") return fail(res, 409, "membership_inactive", "That staff member's access is paused");
      if (clinicians.some((c) => c.membershipId === member.membershipId)) return fail(res, 409, "already_a_clinician", "That staff member is already a clinician");
      const c = { clinicianId: randomUUID(), membershipId: member.membershipId, profession: body.profession, timeZone: body.timeZone, suspension: null, credentials: [], hours: [], timeOff: [] };
      clinicians.push(c);
      send(res, 201, detail(c, mine));
    }],
    ["GET", /^\/v1\/clinicians\/([^/]+)$/, (req, res, [id]) => {
      const s = scope(req, res, id);
      if (s) send(res, 200, detail(s.c, s.mine));
    }],
    ["POST", /^\/v1\/clinicians\/([^/]+)\/suspend$/, async (req, res, [id]) => {
      const s = scope(req, res, id);
      if (!s || !managerOfAnother(res, s, "suspend")) return;
      const body = await readJson(req);
      if (!body?.reason) return bad(res);
      if (s.c.suspension) return fail(res, 409, "already_suspended", "This clinician is already suspended");
      s.c.suspension = { at: new Date().toISOString(), reason: body.reason };
      send(res, 200, detail(s.c, s.mine));
    }],
    ["POST", /^\/v1\/clinicians\/([^/]+)\/resume$/, (req, res, [id]) => {
      const s = scope(req, res, id);
      if (!s || !managerOfAnother(res, s, "lift a suspension")) return;
      if (!s.c.suspension) return fail(res, 409, "not_suspended", "This clinician isn't suspended");
      s.c.suspension = null;
      send(res, 200, detail(s.c, s.mine));
    }],
    ["POST", /^\/v1\/clinicians\/([^/]+)\/credentials$/, async (req, res, [id]) => {
      const s = scope(req, res, id);
      if (!s || !selfOrManager(res, s)) return;
      const body = await readJson(req);
      if (!body?.kind) return bad(res);
      s.c.credentials.push(credential(body.kind, { ...body, createdAt: new Date().toISOString() }));
      send(res, 201, detail(s.c, s.mine));
    }],
    ["POST", /^\/v1\/clinicians\/([^/]+)\/credentials\/([^/]+)\/(verify|review-conditions|withdraw)$/, async (req, res, [id, credentialId, action]) => {
      const s = scope(req, res, id);
      if (!s) return;
      const cr = s.c.credentials.find((x) => x.credentialId === credentialId);
      if (!cr) return fail(res, 404, "not_found", "Credential not found");
      if (cr.withdrawnAt) return fail(res, 409, "credential_withdrawn", "This credential has been withdrawn");
      const now = new Date().toISOString();
      if (action === "withdraw") {
        if (!selfOrManager(res, s)) return;
        if (!s.manages && cr.verifiedAt) return fail(res, 403, "credential_verified", "Ask someone who manages clinicians to withdraw a checked credential");
        const body = await readJson(req);
        Object.assign(cr, { withdrawnAt: now, withdrawalReason: body?.reason ?? "no_longer_held" });
      } else if (action === "verify") {
        if (!managerOfAnother(res, s, "check your credentials")) return;
        if (!cr.verifiedAt) {
          for (const old of s.c.credentials) {
            if (old !== cr && old.kind === cr.kind && !old.withdrawnAt && old.createdAt < cr.createdAt) Object.assign(old, { withdrawnAt: now, withdrawalReason: "replaced" });
          }
        }
        cr.verifiedAt = now;
      } else {
        if (!managerOfAnother(res, s, "review the conditions on your registration")) return;
        if (!cr.conditions) return fail(res, 409, "no_conditions", "This credential has no conditions to review");
        cr.conditionsReviewedAt = now;
      }
      send(res, 200, detail(s.c, s.mine));
    }],
    ["PUT", /^\/v1\/clinicians\/([^/]+)\/hours$/, async (req, res, [id]) => {
      const s = scope(req, res, id);
      if (!s || !selfOrManager(res, s)) return;
      const body = await readJson(req);
      if (!Array.isArray(body?.hours)) return bad(res);
      const hours = body.hours.map((h) => ({ slotMinutes: 15, ...h })).sort((a, b) => a.weekday - b.weekday || a.startsAt.localeCompare(b.startsAt));
      if (hours.some((h) => h.startsAt >= h.endsAt)) return fail(res, 400, "bad_request", "A block ends after it starts");
      if (hours.some((h, i) => i > 0 && hours[i - 1].weekday === h.weekday && h.startsAt < hours[i - 1].endsAt)) {
        return fail(res, 400, "hours_overlap", "Two blocks of hours overlap on the same day");
      }
      s.c.hours = hours;
      send(res, 200, { hours });
    }],
    ["POST", /^\/v1\/clinicians\/([^/]+)\/time-off$/, async (req, res, [id]) => {
      const s = scope(req, res, id);
      if (!s || !selfOrManager(res, s)) return;
      const body = await readJson(req);
      if (!body?.startsAt || !body?.endsAt || !body?.reason || body.startsAt >= body.endsAt) return bad(res);
      const added = { timeOffId: randomUUID(), startsAt: new Date(body.startsAt).toISOString(), endsAt: new Date(body.endsAt).toISOString(), reason: body.reason };
      s.c.timeOff.push(added);
      send(res, 201, added);
    }],
    ["DELETE", /^\/v1\/clinicians\/([^/]+)\/time-off\/([^/]+)$/, (req, res, [id, timeOffId]) => {
      const s = scope(req, res, id);
      if (!s || !selfOrManager(res, s)) return;
      const before = s.c.timeOff.length;
      s.c.timeOff = s.c.timeOff.filter((t) => t.timeOffId !== timeOffId);
      if (s.c.timeOff.length === before) return fail(res, 404, "not_found", "Time off not found");
      send(res, 200, { removed: true });
    }],
  ];
}
