/*
 * The web app's half of ADR 0025: staging and production refuse to start
 * with a setting that is missing or only fit for development. There are no
 * switches around these. Checked once at boot (src/instrumentation.ts).
 */

type Env = Record<string, string | undefined>;

/** What is wrong with a deployed environment's settings; empty when it may start. */
export function unsafeSettings(env: Env): string[] {
  const stage = env.MEDORA_ENV;
  if (stage !== "staging" && stage !== "production") return [];
  const problems: string[] = [];
  const live = stage === "production";

  if (env.MEDORA_PREVIEW) problems.push("MEDORA_PREVIEW is set: preview mode stubs out sign-in and never runs deployed.");

  const backend = env.BACKEND_URL ?? "";
  if (!/^https:\/\/[^/]+/.test(backend)) problems.push("BACKEND_URL must be the API's https address.");

  const publishable = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = env.CLERK_SECRET_KEY ?? "";
  if (live ? !publishable.startsWith("pk_live_") : !/^pk_(test|live)_/.test(publishable)) {
    problems.push(`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must be a ${live ? "pk_live_" : "Clerk"} key.`);
  }
  if (live ? !secret.startsWith("sk_live_") : !/^sk_(test|live)_/.test(secret)) {
    problems.push(`CLERK_SECRET_KEY must be a ${live ? "sk_live_" : "Clerk"} key.`);
  }

  // The patient instance (ADR 0035): its own keys, never the staff instance's.
  const patientPublishable = env.PATIENT_CLERK_PUBLISHABLE_KEY ?? "";
  const patientSecret = env.PATIENT_CLERK_SECRET_KEY ?? "";
  if (live ? !patientPublishable.startsWith("pk_live_") : !/^pk_(test|live)_/.test(patientPublishable)) {
    problems.push(`PATIENT_CLERK_PUBLISHABLE_KEY must be a ${live ? "pk_live_" : "Clerk"} key for the patient instance.`);
  } else if (patientPublishable === publishable) {
    problems.push("PATIENT_CLERK_PUBLISHABLE_KEY is the staff instance's key: patients sign in on their own instance.");
  }
  if (live ? !patientSecret.startsWith("sk_live_") : !/^sk_(test|live)_/.test(patientSecret)) {
    problems.push(`PATIENT_CLERK_SECRET_KEY must be a ${live ? "sk_live_" : "Clerk"} key for the patient instance.`);
  } else if (patientSecret === secret) {
    problems.push("PATIENT_CLERK_SECRET_KEY is the staff instance's key: patients sign in on their own instance.");
  }
  // Clerk carries the patient instance's secret between the proxy and the page encrypted with this.
  if ((env.CLERK_ENCRYPTION_KEY?.trim().length ?? 0) < 32) problems.push("CLERK_ENCRYPTION_KEY must be at least 32 characters.");
  // Every host not named here is a brand's patient host (ADR 0037), so the console's own must be named.
  if (!/^\s*[a-z0-9.-]+(\s*,\s*[a-z0-9.-]+)*\s*$/i.test(env.CONSOLE_HOSTS ?? "")) {
    problems.push("CONSOLE_HOSTS must list the console's hosts, separated by commas.");
  }

  if ((env.FORWARDED_IP_SECRET?.trim().length ?? 0) < 32) {
    problems.push("FORWARDED_IP_SECRET must be at least 32 characters, the same value as the API's.");
  }

  const release = env.NEXT_PUBLIC_RELEASE_SHA ?? "";
  if (!/^[0-9a-f]{7,40}$/.test(release)) problems.push("The release commit is unknown: the deploy writes release-sha.txt before the build.");

  return problems;
}

/** Staging and production stop here with a setting that isn't safe; the running release stays up. */
export function refuseUnsafeSettings(): void {
  // The release commit is baked into the build (next.config.ts), so it is read by name, not from the process's env.
  const problems = unsafeSettings({ ...process.env, NEXT_PUBLIC_RELEASE_SHA: process.env.NEXT_PUBLIC_RELEASE_SHA });
  if (problems.length === 0) return;
  process.stderr.write(`Medora web refuses to start (ADR 0025):\n  ${problems.join("\n  ")}\n`);
  process.exit(1);
}
