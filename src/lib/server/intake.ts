import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HEADER } from "@/lib/api/tenant-header";
import { BRAND_HOST_HEADER, normaliseHost } from "@/lib/surface";
import { backendApiUrl, backendToken } from "@/lib/server/backend";
import { brandLookup } from "@/lib/server/brand";
import { clientIpHeaders } from "@/lib/server/client-ip";
import { inertHeaders, refusal } from "@/lib/server/relay";
import {
  cookieOptions,
  HELD_FOR_SECONDS,
  INTAKE_COOKIE,
  INTAKE_TOKEN_HEADER,
  isIntakeId,
  readHeld,
  TOKEN,
  withHeld,
  writeHeld,
  type HeldIntake,
} from "@/lib/server/intake-tokens";

/*
 * An intake before an account, on a brand's patient host (ADR 0280). The
 * relay reaches only the API's /v1/patient/* from a brand's host (ADR 0180);
 * these handlers are the one other way, and reach exactly the anonymous
 * intake routes and the claim. Each one:
 *
 * - works only on a brand's host, whose tenant it names from the brand, as
 *   the relay does (docs/decisions/patient-app.md APP2);
 * - takes the resume token from the cookie, never from the browser, and
 *   never sends one back (intake-tokens.ts);
 * - takes JSON only, so another site's form can't post here, and the
 *   cookie is SameSite=Lax, so another site's script can't send it;
 * - answers no-store, as every patient reply does (APP3).
 */

const MAX_BODY_BYTES = 64 * 1024;
const STEP_KEY = /^[a-z][a-z0-9_]{0,47}$/;
/** Why an intake ends that leaves nothing to come back to: its entry is dropped (docs/decisions/patient-start.md JOIN4). */
const GONE_REASONS = new Set(["unclaimed", "expired", "version_withdrawn"]);

interface BrandOf {
  host: string;
  tenantId: string;
  brandId: string;
}

/** The brand of the patient host this request came in on, or the refusal to send. */
async function brandOf(request: NextRequest): Promise<BrandOf | NextResponse> {
  // Only the proxy writes this header, and only on a brand's host: the console has no intakes.
  const host = normaliseHost(request.headers.get(BRAND_HOST_HEADER));
  if (!host) return refusal("not_found", "Route not found", 404);
  const lookup = await brandLookup(host);
  if (lookup.state === "found") return { host, tenantId: lookup.brand.tenantId, brandId: lookup.brand.brandId };
  if (lookup.state === "unknown") return refusal("not_found", "Route not found", 404);
  return refusal("backend_unreachable", "Medora can't be reached at the moment", 503);
}

/** A JSON body of a sensible size, as text, or the refusal to send. */
async function jsonBody(request: NextRequest): Promise<string | NextResponse> {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) {
    return refusal("unsupported_media_type", "Send the answers as JSON", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return refusal("too_large", "That is more than an intake takes", 413);
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return refusal("too_large", "That is more than an intake takes", 413);
  return text;
}

async function callApi(
  request: NextRequest,
  brand: BrandOf,
  path: string,
  init: { method: string; body?: string; intakeToken?: string; sessionToken?: string },
): Promise<Response | NextResponse> {
  const headers = new Headers({ accept: "application/json", [TENANT_HEADER]: brand.tenantId, [BRAND_HOST_HEADER]: brand.host });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.intakeToken) headers.set(INTAKE_TOKEN_HEADER, init.intakeToken);
  if (init.sessionToken) headers.set("authorization", `Bearer ${init.sessionToken}`);
  for (const [name, value] of Object.entries(clientIpHeaders(request.headers))) headers.set(name, value);
  try {
    return await fetch(backendApiUrl(path), {
      method: init.method,
      headers,
      body: init.body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch {
    return refusal("backend_unreachable", "Medora can't be reached at the moment", 502);
  }
}

/** The API's reply as it came, minus anything but the headers a page needs: the token header never comes back. */
function passOn(upstream: Response, body: BodyInit | null = upstream.body): NextResponse {
  const headers = inertHeaders(upstream.headers);
  headers.set("cache-control", "no-store");
  return new NextResponse(upstream.status === 204 ? null : body, { status: upstream.status, headers });
}

function heldIn(request: NextRequest): HeldIntake[] {
  return readHeld(request.cookies.get(INTAKE_COOKIE)?.value);
}

function keep(response: NextResponse, held: readonly HeldIntake[]): NextResponse {
  if (held.length === 0) response.cookies.set(INTAKE_COOKIE, "", cookieOptions(0));
  else response.cookies.set(INTAKE_COOKIE, writeHeld(held), cookieOptions(HELD_FOR_SECONDS));
  return response;
}

type View = { intakeId?: unknown; programId?: unknown; status?: unknown; endedReason?: unknown };

/** POST /api/start/intakes: start an intake before an account, and hold its token. */
export async function startIntake(request: NextRequest): Promise<NextResponse> {
  const brand = await brandOf(request);
  if (brand instanceof NextResponse) return brand;
  const body = await jsonBody(request);
  if (body instanceof NextResponse) return body;

  const upstream = await callApi(request, brand, "/public/intakes", { method: "POST", body });
  if (upstream instanceof NextResponse) return upstream;
  if (upstream.status !== 201) return passOn(upstream);

  const token = upstream.headers.get(INTAKE_TOKEN_HEADER) ?? "";
  const text = await upstream.text();
  let view: View = {};
  try {
    view = JSON.parse(text) as View;
  } catch {
    // Checked below: a reply this server can't read can't be held.
  }
  const { intakeId, programId } = view;
  if (!TOKEN.test(token) || typeof intakeId !== "string" || !isIntakeId(intakeId) || typeof programId !== "string" || !isIntakeId(programId)) {
    return refusal("backend_unreachable", "Medora can't be reached at the moment", 502);
  }
  return keep(passOn(upstream, text), withHeld(heldIn(request), { intakeId, programId, token }));
}

/** The held entry for an intake id in the path, or the refusal: an intake this browser doesn't hold is one the API would say isn't found. */
function heldEntry(request: NextRequest, intakeId: string): HeldIntake | NextResponse {
  if (!isIntakeId(intakeId)) return refusal("not_found", "Intake not found", 404);
  return heldIn(request).find((h) => h.intakeId === intakeId) ?? refusal("not_found", "Intake not found", 404);
}

/**
 * After the API answered for a held intake: keep the cookie for another 14
 * days from an answer saved, and drop the entry when the intake is gone (its
 * token no longer finds it, or it lapsed), so nothing dead is kept.
 */
async function settle(request: NextRequest, upstream: Response, entry: HeldIntake, saved: boolean): Promise<NextResponse> {
  const held = heldIn(request);
  if (upstream.status === 404) return keep(passOn(upstream), held.filter((h) => h.intakeId !== entry.intakeId));
  if (!upstream.ok) return passOn(upstream);
  const text = await upstream.text();
  let view: View = {};
  try {
    view = JSON.parse(text) as View;
  } catch {
    return passOn(upstream, text);
  }
  const gone = view.status === "ended" && typeof view.endedReason === "string" && GONE_REASONS.has(view.endedReason);
  if (gone) return keep(passOn(upstream, text), held.filter((h) => h.intakeId !== entry.intakeId));
  return saved ? keep(passOn(upstream, text), held) : passOn(upstream, text);
}

/** GET /api/start/intakes/:intakeId: an intake this browser holds, with its answers. */
export async function readHeldIntake(request: NextRequest, intakeId: string): Promise<NextResponse> {
  const brand = await brandOf(request);
  if (brand instanceof NextResponse) return brand;
  const entry = heldEntry(request, intakeId);
  if (entry instanceof NextResponse) return entry;
  const upstream = await callApi(request, brand, `/public/intakes/${entry.intakeId}`, { method: "GET", intakeToken: entry.token });
  if (upstream instanceof NextResponse) return upstream;
  return settle(request, upstream, entry, false);
}

/** PUT /api/start/intakes/:intakeId/steps/:stepKey: answer one step of a held intake. */
export async function answerHeldStep(request: NextRequest, intakeId: string, stepKey: string): Promise<NextResponse> {
  const brand = await brandOf(request);
  if (brand instanceof NextResponse) return brand;
  const entry = heldEntry(request, intakeId);
  if (entry instanceof NextResponse) return entry;
  if (!STEP_KEY.test(stepKey)) return refusal("not_found", "Step not found", 404);
  const body = await jsonBody(request);
  if (body instanceof NextResponse) return body;
  const upstream = await callApi(request, brand, `/public/intakes/${entry.intakeId}/steps/${stepKey}`, {
    method: "PUT",
    body,
    intakeToken: entry.token,
  });
  if (upstream instanceof NextResponse) return upstream;
  return settle(request, upstream, entry, true);
}

/**
 * POST /api/start/claim: make every intake this browser holds the signed-in
 * patient's own (INT6). Nothing held is nothing to do. The cookie goes only
 * once the API has claimed; a refusal (no account yet, date of birth not yet
 * confirmed) keeps it for the next try.
 */
export async function claimHeld(request: NextRequest): Promise<NextResponse> {
  const brand = await brandOf(request);
  if (brand instanceof NextResponse) return brand;
  const session = await backendToken();
  if (!session) return refusal("unauthorized", "Sign in to carry on", 401);
  const held = heldIn(request);
  if (held.length === 0) {
    const none = NextResponse.json({ claimed: [] }, { headers: { "cache-control": "no-store" } });
    return request.cookies.has(INTAKE_COOKIE) ? keep(none, []) : none;
  }
  const upstream = await claim(request, brand, session, held);
  if (upstream instanceof NextResponse) return upstream;
  if (!upstream.ok) return passOn(upstream);
  return keep(passOn(upstream), []);
}

function claim(request: NextRequest, brand: BrandOf, session: string, held: readonly HeldIntake[]) {
  const body = JSON.stringify({ tokens: held.map((h) => h.token) });
  return callApi(request, brand, "/patient/intakes/claim", { method: "POST", body, sessionToken: session });
}

/**
 * POST /api/start/account: create the signed-in person's account through
 * this host's brand, then claim what the browser holds (IDN20, INT6). The
 * brand is this server's, from the host, never the browser's: a patient
 * no more chooses a brand than a tenant (APP2). A claim that fails here
 * leaves the cookie for the next try (JOIN3); the account
 * stands either way.
 */
export async function createAccount(request: NextRequest): Promise<NextResponse> {
  const brand = await brandOf(request);
  if (brand instanceof NextResponse) return brand;
  const session = await backendToken();
  if (!session) return refusal("unauthorized", "Sign in to carry on", 401);
  const text = await jsonBody(request);
  if (text instanceof NextResponse) return text;
  let details: unknown;
  try {
    details = JSON.parse(text);
  } catch {
    return refusal("bad_request", "Some of what was sent is missing or not in the right form", 400);
  }
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return refusal("bad_request", "Some of what was sent is missing or not in the right form", 400);
  }
  const body = JSON.stringify({ ...details, brandId: brand.brandId });
  const upstream = await callApi(request, brand, "/patient/account", { method: "POST", body, sessionToken: session });
  if (upstream instanceof NextResponse) return upstream;
  if (upstream.status !== 201) return passOn(upstream);

  const account = await upstream.text();
  const held = heldIn(request);
  if (held.length === 0) return passOn(upstream, account);
  const claimed = await claim(request, brand, session, held);
  const response = passOn(upstream, account);
  return claimed instanceof NextResponse || !claimed.ok ? response : keep(response, []);
}
