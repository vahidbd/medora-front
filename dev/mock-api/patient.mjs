/**
 * The mock API's brands and patient routes (dev/README.md), in the API's
 * shapes: GET /v1/public/brands/by-host/:host (no session), and the
 * /v1/patient/* routes a patient token reaches.
 *
 * Brands, patients and programs are made up. The preview patient session
 * comes from the mock Clerk as a bearer `mock-patient-<kind>-<sid>`:
 * "patient" has a record in both demo tenants, "new" has none yet. Each
 * session confirms the date of birth once, as the API asks (ADR 0100).
 */

const TENANT_HEADER = "x-medora-tenant";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATIENT_TOKEN = /^Bearer mock-patient-(patient|new)-([a-z0-9]{1,16})$/;
const MAX_DATE_OF_BIRTH_TRIES = 5;

export const HARBOUR = "10000000-0000-4000-8000-000000000001";
export const COASTAL = "10000000-0000-4000-8000-000000000002";

const BRANDS = [
  {
    host: "kestrel.localhost",
    brand: {
      brandId: "30000000-0000-4000-8000-000000000001",
      tenantId: HARBOUR,
      name: "Kestrel Health (demo)",
      status: "live",
      logoUrl: null,
      primaryColour: "#0f766e",
      supportEmail: "help@kestrel.example.test",
      supportPhone: "1300 000 001",
      timeZone: "Australia/Sydney",
    },
  },
  {
    host: "larkspur.localhost",
    brand: {
      brandId: "30000000-0000-4000-8000-000000000002",
      tenantId: COASTAL,
      name: "Larkspur Clinic (demo)",
      status: "paused",
      logoUrl: null,
      primaryColour: "#facc15",
      supportEmail: null,
      supportPhone: null,
      timeZone: "Australia/Perth",
    },
  },
];

/** Jamie Taylor is made up. One record per tenant (ADR 0100), each with its own id. */
function jamie(patientId, programs) {
  return {
    patientId,
    givenName: "Jamie",
    familyName: "Taylor",
    preferredName: null,
    displayName: "Jamie Taylor",
    dateOfBirth: "1988-05-14",
    sex: "not_stated",
    timeZone: null,
    identityStatus: "verified",
    email: "jamie@example.test",
    mobile: "0400 000 000",
    address: null,
    medicare: null,
    createdAt: "2026-11-02T01:15:00.000Z",
    consentsNeeded: [],
    programs,
  };
}

const PATIENTS = new Map([
  [
    HARBOUR,
    jamie("40000000-0000-4000-8000-000000000001", [
      { programId: "50000000-0000-4000-8000-000000000001", name: "Weight care (demo)", measurements: ["weight", "waist"], checkInEveryDays: 7 },
    ]),
  ],
  [COASTAL, jamie("40000000-0000-4000-8000-000000000002", [])],
]);

const confirmed = new Set();
/** Notification preferences by session, so tests side by side don't share them; no entry means the defaults. */
const preferences = new Map();
const tries = new Map();

export function brandByHost(host) {
  return BRANDS.find((b) => b.host === host)?.brand ?? null;
}

/**
 * The signed-in patient, or a reply already sent. "patient-sign-in" access
 * needs only a token in a tenant; "patient" also needs the record and this
 * session's date of birth check (the API's own order of refusals).
 */
export function patientOf(req, res, fail, access) {
  const token = PATIENT_TOKEN.exec(req.headers.authorization ?? "");
  if (!token) {
    fail(res, 401, "unauthorized", "Your sign-in has expired or is not valid. Sign in again.");
    return null;
  }
  const tenantId = req.headers[TENANT_HEADER];
  if (typeof tenantId !== "string" || !UUID.test(tenantId)) {
    fail(res, 400, "tenant_required", `${TENANT_HEADER} must be a tenant id`);
    return null;
  }
  if (!BRANDS.some((b) => b.brand.tenantId === tenantId)) {
    fail(res, 403, "tenant_unavailable", "This service isn't available here");
    return null;
  }
  const [, kind, sid] = token;
  const record = kind === "patient" ? PATIENTS.get(tenantId) : null;
  const session = `${tenantId}:${sid}`;
  if (access === "patient" && !record) {
    fail(res, 403, "no_patient_record", "Create your account first");
    return null;
  }
  if (access === "patient" && !confirmed.has(session)) {
    fail(res, 403, "date_of_birth_needed", "Confirm your date of birth to carry on");
    return null;
  }
  return { tenantId, record, session };
}

/** The routes, in the server's [method, pattern, handler] shape. */
export function patientRoutes({ send, fail, readJson }) {
  return [
    [
      "GET",
      /^\/v1\/public\/brands\/by-host\/([^/]+)$/,
      (req, res, [host]) => {
        const brand = brandByHost(decodeURIComponent(host).toLowerCase());
        if (!brand) return fail(res, 404, "not_found", "Brand not found");
        send(res, 200, brand);
      },
    ],
    [
      "GET",
      /^\/v1\/patient\/me$/,
      (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (patient) send(res, 200, patient.record);
      },
    ],
    [
      "POST",
      /^\/v1\/patient\/confirm-date-of-birth$/,
      async (req, res) => {
        const patient = patientOf(req, res, fail, "patient-sign-in");
        if (!patient) return;
        if (!patient.record) return fail(res, 403, "no_patient_record", "Create your account first");
        const body = await readJson(req);
        const keys = body && typeof body === "object" ? Object.keys(body) : [];
        if (keys.length !== 1 || keys[0] !== "dateOfBirth" || !/^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)) {
          return fail(res, 400, "bad_request", "Some of what was sent is missing or not in the right form");
        }
        const used = tries.get(patient.session) ?? 0;
        if (used >= MAX_DATE_OF_BIRTH_TRIES) return fail(res, 429, "too_many_requests", "Too many tries. Wait a few minutes, then try again.");
        if (body.dateOfBirth !== patient.record.dateOfBirth) {
          tries.set(patient.session, used + 1);
          return fail(res, 403, "date_of_birth_mismatch", "That date of birth doesn't match your account");
        }
        confirmed.add(patient.session);
        send(res, 200, { confirmed: true });
      },
    ],
    [
      "GET",
      /^\/v1\/patient\/notification-preferences$/,
      (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (patient) send(res, 200, preferences.get(patient.session) ?? { sms: true, reminders: true });
      },
    ],
    [
      "PUT",
      /^\/v1\/patient\/notification-preferences$/,
      async (req, res) => {
        const patient = patientOf(req, res, fail, "patient");
        if (!patient) return;
        const body = await readJson(req);
        const keys = body && typeof body === "object" ? Object.keys(body).sort().join(",") : "";
        if (keys !== "reminders,sms" || typeof body.sms !== "boolean" || typeof body.reminders !== "boolean") {
          return fail(res, 400, "bad_request", "Some of what was sent is missing or not in the right form");
        }
        preferences.set(patient.session, { sms: body.sms, reminders: body.reminders });
        send(res, 200, preferences.get(patient.session));
      },
    ],
  ];
}
