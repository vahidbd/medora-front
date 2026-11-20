import type { StatusTone } from "@/components/shared/status-badge";
import type { AuState, BrandStatus, OnboardingItem, TimeZone } from "@/lib/api/types";

/** Words for a tenant's set-up: brands, companies, settings and the onboarding checklist (docs/decisions/admin.md ADM14 to ADM20). */

export const BRAND_STATUS: Record<BrandStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  live: { label: "Live", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
};

export const ONBOARDING_LABELS: Record<OnboardingItem, { title: string; help: string }> = {
  company: {
    title: "Add a company",
    help: "The legal entity patients deal with, with its ABN.",
  },
  live_brand: {
    title: "Take a brand live",
    help: "Needs a support email and a domain Medora has verified.",
  },
  medical_director: {
    title: "Invite a medical director",
    help: "Someone active in the Medical director role.",
  },
  prescriber: {
    title: "Invite a prescriber",
    help: "At least one active prescriber, so patients can be treated.",
  },
};

/** Australia's time zones, by the city people know them by (ADR 0017). */
export const TIME_ZONE_LABELS: Record<TimeZone, string> = {
  "Australia/Sydney": "Sydney, Canberra",
  "Australia/Melbourne": "Melbourne",
  "Australia/Brisbane": "Brisbane",
  "Australia/Adelaide": "Adelaide",
  "Australia/Darwin": "Darwin",
  "Australia/Perth": "Perth",
  "Australia/Hobart": "Hobart",
  "Australia/Lord_Howe": "Lord Howe Island",
  "Australia/Eucla": "Eucla",
  "Australia/Broken_Hill": "Broken Hill",
  "Indian/Christmas": "Christmas Island",
  "Indian/Cocos": "Cocos (Keeling) Islands",
  "Antarctica/Macquarie": "Macquarie Island",
};

export const AU_STATE_LABELS: Record<AuState, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};
