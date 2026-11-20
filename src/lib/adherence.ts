import type { StatusTone } from "@/components/shared/status-badge";
import type { AdherenceFlagKind, AdherenceFlagOutcome, AdherenceFlagUrgency } from "@/lib/api/types";

/** How each urgency reads, and its tone: colour is for status, and the label always says it. */
export const FLAG_URGENCY: Record<AdherenceFlagUrgency, { label: string; tone: StatusTone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  soon: { label: "Soon", tone: "warning" },
  routine: { label: "Routine", tone: "neutral" },
};

/** What raised an adherence flag, as words. */
export const FLAG_KIND_LABELS: Record<AdherenceFlagKind, string> = {
  side_effect_reported: "Side effect reported",
};

/** What the care team did, as the person resolving picks it and as the list shows it. */
export const FLAG_OUTCOMES: Record<AdherenceFlagOutcome, { label: string; detail: string }> = {
  contacted_patient: { label: "Contacted the patient", detail: "You spoke with them or left a message, and nothing more is needed now." },
  booked_review: { label: "Booked a review", detail: "A consult is booked to look at it." },
  referred_to_prescriber: { label: "Referred to a prescriber", detail: "A prescriber is taking it from here." },
  no_action_needed: { label: "No action needed", detail: "Read and judged not to need anything." },
};
