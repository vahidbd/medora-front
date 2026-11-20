import "server-only";

/*
 * The resume tokens of intakes started in this browser before an account
 * (docs/decisions/intake.md INT5 in medora-backend, ADR 0280). The API sends
 * a token once, in a reply header; this server keeps it in one cookie the
 * page can't read, and sends it back in the same header. The browser never
 * holds a token in script, a URL or storage.
 *
 * The cookie is `__Host-` prefixed: the browser takes it only over a secure
 * connection, from this exact host, for every path, and no other host (a
 * sibling brand's subdomain included) can set or shadow it. It holds up to
 * the 20 intakes the API's claim takes at once, oldest dropped first, as
 * "<intakeId>~<programId>~<token>" entries joined by ".": neither character
 * appears in an id or a base64url token, neither needs escaping in a
 * cookie, and the whole stays under the 4 KB a browser keeps for one.
 */

export const INTAKE_COOKIE = "__Host-medora-intake";
/** The API's header for a resume token, both ways. */
export const INTAKE_TOKEN_HEADER = "x-medora-intake-token";
/** The most the API claims at once (POST /v1/patient/intakes/claim). */
export const MAX_HELD = 20;
/** Unclaimed answers are cleared 14 days after the last one (INT7), so the cookie lasts as long, from the last answer saved. */
export const HELD_FOR_SECONDS = 14 * 24 * 60 * 60;

export interface HeldIntake {
  intakeId: string;
  programId: string;
  token: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** What the API's claim accepts as a token. */
export const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

export function isId(value: string): boolean {
  return UUID.test(value);
}

/** The held intakes in a cookie value, oldest first. Anything that isn't a well-formed entry is dropped, never repaired. */
export function readHeld(value: string | undefined | null): HeldIntake[] {
  if (!value) return [];
  const held: HeldIntake[] = [];
  for (const entry of value.split(".")) {
    const parts = entry.split("~");
    if (parts.length !== 3) continue;
    const [intakeId, programId, token] = parts as [string, string, string];
    if (!UUID.test(intakeId) || !UUID.test(programId) || !TOKEN.test(token)) continue;
    const kept = held.findIndex((h) => h.intakeId === intakeId);
    if (kept >= 0) held.splice(kept, 1);
    held.push({ intakeId, programId, token });
  }
  return held.slice(-MAX_HELD);
}

/** The cookie value for these intakes; the newest 20 if there are more. */
export function writeHeld(held: readonly HeldIntake[]): string {
  return held
    .slice(-MAX_HELD)
    .map((h) => `${h.intakeId}~${h.programId}~${h.token}`)
    .join(".");
}

/** The held intakes with one more, as the newest; an intake already held moves to the end with its new token. */
export function withHeld(held: readonly HeldIntake[], next: HeldIntake): HeldIntake[] {
  return [...held.filter((h) => h.intakeId !== next.intakeId), next].slice(-MAX_HELD);
}

/** The newest intake held for a program, if any. */
export function heldFor(held: readonly HeldIntake[], programId: string): HeldIntake | null {
  return held.findLast((h) => h.programId === programId) ?? null;
}

/** How the cookie is set: script can't read it, and it goes only to this host, over a secure connection, on same-site requests and links. */
export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}
