/**
 * The mock API's consent documents and each patient session's decisions,
 * in the API's shapes (docs/decisions/patients.md IDN12 to IDN14 in
 * medora-backend). The documents are made up. A session that signs in as
 * Jamie has already agreed to both care documents; a new account has agreed
 * to nothing until it claims an intake (which records the privacy notice it
 * was started under) or agrees here.
 */

const PUBLISHED_AT = "2026-11-01T00:00:00.000Z";

export const PRIVACY = {
  documentId: "70000000-0000-4000-8000-000000000001",
  kind: "privacy",
  version: 3,
  title: "Privacy and your health information",
  body: [
    "Kestrel Health (demo) collects the answers you give here, including information about your health, so a clinician can decide whether our care suits you and, if it does, provide it.",
    "We keep your answers on this device for 14 days so you can come back to them. If you don't create an account, we delete them after that.",
    "We share your information only with the clinicians and pharmacies involved in your care, and never for advertising. You can ask for a copy of what we hold, or ask us to correct it, at any time.",
  ].join("\n\n"),
  publishedAt: PUBLISHED_AT,
};

export const TELEHEALTH_TERMS = {
  documentId: "70000000-0000-4000-8000-000000000002",
  kind: "telehealth_terms",
  version: 2,
  title: "Telehealth terms",
  body: [
    "A clinician assesses you by phone, video or secure message. They prescribe only when it is safe and right for you, and may ask you to see someone in person.",
    "Telehealth isn't for emergencies. If you're in danger or need urgent help, call 000.",
    "You can stop at any time. Ending a program doesn't change what was already sent to a pharmacy.",
  ].join("\n\n"),
  publishedAt: PUBLISHED_AT,
};

const KINDS = ["privacy", "telehealth_terms", "identity_check", "pharmacy_sharing"];
const DOCUMENTS = new Map([PRIVACY, TELEHEALTH_TERMS].map((document) => [document.kind, document]));
const CARE = ["privacy", "telehealth_terms"];

/** Decisions by patient session: kind to the version agreed. */
const decisions = new Map();

function decided(session) {
  if (!decisions.has(session)) decisions.set(session, new Map());
  return decisions.get(session);
}

/** Jamie's sessions start with both care documents agreed, as their account did long ago. */
export function seedAgreed(session) {
  if (decisions.has(session)) return;
  decided(session).set("privacy", PRIVACY.version).set("telehealth_terms", TELEHEALTH_TERMS.version);
}

/** The patient's position on every kind (`consentState`). */
export function consentStates(session) {
  const mine = decided(session);
  return KINDS.map((kind) => {
    const document = DOCUMENTS.get(kind) ?? null;
    const version = mine.get(kind) ?? null;
    return { kind, document, decision: version === null ? null : "given", decidedVersion: version, needed: !(document && version === document.version) };
  });
}

/** The care consents still needed: what starting an intake and submitting it check (CONSENTS_FOR.care). */
export function careConsentsNeeded(session) {
  return consentStates(session)
    .filter((state) => state.needed && CARE.includes(state.kind))
    .map((state) => state.kind);
}

/** Agree to a current document; null when the id isn't one. */
export function agree(session, documentId) {
  const document = [...DOCUMENTS.values()].find((d) => d.documentId === documentId);
  if (!document) return null;
  decided(session).set(document.kind, document.version);
  return consentStates(session);
}
