import type { StatusTone } from "@/components/shared/status-badge";
import type { Credential, Profession, Standing, StandingReason, StandingWarning, SuspensionReason, TimeOffReason } from "@/lib/api/types";

/** How the workforce's API values read on a screen. The values stay as the API sends them; the words come from here alone. */

export const PROFESSION_LABELS: Record<Profession, string> = {
  medical_practitioner: "Medical practitioner",
  nurse_practitioner: "Nurse practitioner",
  registered_nurse: "Registered nurse",
  pharmacist: "Pharmacist",
  dietitian: "Dietitian",
  psychologist: "Psychologist",
  health_coach: "Health coach",
};

export const STANDING_REASON_LABELS: Record<StandingReason, string> = {
  no_clinician_profile: "Not set up as a clinician",
  membership_inactive: "Their access to this tenant is paused",
  suspended: "Suspended",
  registration_missing: "No registration recorded",
  registration_unverified: "Registration waiting for a check",
  registration_expired: "Registration has expired",
  registration_not_practising: "Registration is not practising",
  registration_conditions_unreviewed: "Conditions on the registration need a review",
  indemnity_missing: "No indemnity recorded",
  indemnity_unverified: "Indemnity waiting for a check",
  indemnity_expired: "Indemnity has expired",
  indemnity_excludes_telehealth: "Indemnity doesn't cover telehealth with new patients",
  not_a_prescriber: "Their profession doesn't prescribe",
  endorsement_missing: "No nurse practitioner endorsement recorded",
  endorsement_unverified: "Endorsement waiting for a check",
  endorsement_expired: "Endorsement has expired",
};

export const STANDING_WARNING_LABELS: Record<StandingWarning, string> = {
  recheck_due: "Registration check is more than 31 days old",
  expires_soon: "A credential ends within 30 days",
};

/** One badge for a clinician's standing: what they may do now. */
export function standingBadge(standing: Standing): { label: string; tone: StatusTone } {
  if (standing.mayPrescribe) return { label: standing.warnings.length > 0 ? "Can prescribe, check due" : "Can prescribe", tone: standing.warnings.length > 0 ? "warning" : "success" };
  if (standing.mayConsult) return { label: "Can consult", tone: "info" };
  return { label: "Can't consult", tone: "danger" };
}

export const SUSPENSION_REASON_LABELS: Record<SuspensionReason, string> = {
  registration_concern: "A concern about their registration",
  indemnity_concern: "A concern about their indemnity",
  clinical_governance: "Clinical governance",
  leave: "Leave",
  other: "Other",
};

export const TIME_OFF_REASON_LABELS: Record<TimeOffReason, string> = {
  leave: "Leave",
  sick: "Sick",
  training: "Training",
  other: "Other",
};

export const CREDENTIAL_KIND_LABELS: Record<Credential["kind"], string> = {
  registration: "Registration",
  endorsement: "Nurse practitioner endorsement",
  indemnity: "Indemnity",
};

export const REGISTRATION_STATUS_LABELS: Record<NonNullable<Credential["registrationStatus"]>, string> = {
  practising: "Practising",
  non_practising: "Non-practising",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export const REGISTRATION_TYPE_LABELS: Record<NonNullable<Credential["registrationType"]>, string> = {
  general: "General",
  specialist: "Specialist",
  provisional: "Provisional",
  limited: "Limited",
};

/** The register that holds each profession: none for a health coach (WRK1). */
export const REGISTERED_BY: Record<Profession, "ahpra" | "dietitians_australia" | null> = {
  medical_practitioner: "ahpra",
  nurse_practitioner: "ahpra",
  registered_nurse: "ahpra",
  pharmacist: "ahpra",
  psychologist: "ahpra",
  dietitian: "dietitians_australia",
  health_coach: null,
};

export const REGISTERING_BODY_LABELS: Record<"ahpra" | "dietitians_australia", string> = {
  ahpra: "Ahpra",
  dietitians_australia: "Dietitians Australia",
};

/** Where a credential stands, for its row's badge. */
export function credentialState(credential: Credential): { label: string; tone: StatusTone } {
  if (credential.withdrawalReason === "replaced") return { label: "Replaced", tone: "neutral" };
  if (credential.withdrawnAt) return { label: "Withdrawn", tone: "neutral" };
  if (!credential.verifiedAt) return { label: "Waiting for a check", tone: "warning" };
  if (credential.conditions && !credential.conditionsReviewedAt) return { label: "Conditions to review", tone: "warning" };
  if (credential.counts) return { label: "Counts", tone: "success" };
  return { label: "Checked", tone: "neutral" };
}

/** ISO weekdays: 1 is Monday. */
export const WEEKDAYS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 7, label: "Sunday" },
] as const;

/** Time zones a clinician in Australia works in. */
export const TIME_ZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Perth",
  "Australia/Hobart",
] as const;
