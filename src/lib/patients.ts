import type { StatusTone } from "@/components/shared/status-badge";
import type { ConsentKind, IdentityDocument, IdentityStatus, IhiStatus, Sex } from "@/lib/api/types";

/** Words for patients, identity and consent (docs/decisions/patients.md). The API's values stay as they are; the words come from here. */

export const IDENTITY_STATUS: Record<IdentityStatus, { label: string; tone: StatusTone }> = {
  unverified: { label: "Not verified", tone: "neutral" },
  verified: { label: "Verified", tone: "success" },
  failed: { label: "Checks didn't match", tone: "warning" },
};

export const SEX_LABELS: Record<Sex, string> = {
  female: "Female",
  male: "Male",
  intersex: "Intersex",
  not_stated: "Not stated",
};

export const DOCUMENT_LABELS: Record<IdentityDocument, string> = {
  driver_licence: "Driver licence",
  passport: "Australian passport",
  medicare_card: "Medicare card",
};

export const IHI_STATUS_LABELS: Record<IhiStatus, string> = {
  active: "Active",
  deceased: "Deceased",
  retired: "Retired",
  expired: "Expired",
  resolved: "Resolved",
};

export const CONSENT_KIND_LABELS: Record<ConsentKind, string> = {
  privacy: "Privacy and collection notice",
  telehealth_terms: "Telehealth terms",
  identity_check: "Identity check",
  pharmacy_sharing: "Sharing with the pharmacy",
};
