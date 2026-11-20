import type { StatusTone } from "@/components/shared/status-badge";
import type {
  AgentChannel,
  AgentEvals,
  AgentKind,
  AgentMessageRole,
  AgentOffReason,
  AgentRunStatus,
  AgentRunTrigger,
  DecisionReason,
  ProposalStatus,
} from "@/lib/api/types";
import { formatDateTime, formatMoney } from "@/lib/format";

/**
 * How agents read on a screen (docs/decisions/agents.md). The API's values
 * stay as they are; the words come from here alone.
 */
export const AGENT_LABELS: Record<AgentKind, string> = {
  intake: "Intake agent",
  support: "Support agent",
  care_coordinator: "Care coordinator",
  clinical_copilot: "Clinical copilot",
};

export const AGENT_DESCRIPTIONS: Record<AgentKind, string> = {
  intake: "Helps patients finish intake and book their first consult. Never gives medical advice.",
  support: "Answers patients from the help centre, and about their own orders and consults.",
  care_coordinator: "Sends the reminders a care plan sets and books review consults.",
  clinical_copilot: "Summarises an intake for the prescriber, who accepts, edits or rejects it.",
};

export const CHANNEL_LABELS: Record<AgentChannel, string> = {
  chat: "Chat",
  email: "Email",
  sms: "SMS",
  voice: "Phone",
  job: "Jobs",
};

/** Why an agent isn't running, most general first. */
export const OFF_LABELS: Record<AgentOffReason, string> = {
  platform_off: "Off for all of Medora",
  tenant_paused: "Paused with all agents",
  agent_off: "Off",
};

export const EVAL_LABELS: Record<AgentEvals, { label: string; tone: StatusTone; help: string }> = {
  passed: { label: "Passed", tone: "success", help: "This version passed its eval set." },
  failed: { label: "Failed", tone: "danger", help: "This version failed its eval set, so it can't be switched on." },
  stale: { label: "Out of date", tone: "warning", help: "The agent changed since its last eval, so it can't be switched on until it passes again." },
  none: { label: "Not evaluated", tone: "neutral", help: "This version has no eval result yet, so it can't be switched on." },
};

/** Each tool in words: what the agent does when it uses it. Unknown tools show their name. */
const TOOL_LABELS: Record<string, string> = {
  search_help_centre: "Search the help centre",
  get_order_status: "Look up the patient's orders",
  get_next_consult: "Look up the patient's next consult",
  request_refund: "Refund an order",
  get_intake_progress: "See how far intake has got",
  list_consult_times: "List open consult times",
  book_consult: "Book the patient's consult",
  reschedule_consult: "Move the patient's consult",
  cancel_consult: "Cancel the patient's consult",
  get_care_plan: "Read the patient's care plan",
  send_template_message: "Send an approved message template",
  get_intake_answers: "Read the intake's answers",
  get_protocol_checklist: "Read the protocol checklist",
  save_intake_summary: "Save an intake summary for the prescriber",
};

export const toolLabel = (name: string): string => TOOL_LABELS[name] ?? name;

export const RUN_STATUS: Record<AgentRunStatus, { label: string; tone: StatusTone }> = {
  queued: { label: "Waiting", tone: "neutral" },
  running: { label: "Running", tone: "info" },
  completed: { label: "Replied", tone: "success" },
  handed_off: { label: "Handed off", tone: "warning" },
  stopped: { label: "Stopped", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export const TRIGGER_LABELS: Record<AgentRunTrigger, string> = {
  message: "Patient message",
  staff: "Staff member",
  schedule: "Schedule",
  event: "Event",
  call: "Phone call",
};

/** Why a run ended (the run's end reason), in words. Unknown reasons show as they are. */
const END_REASONS: Record<string, string> = {
  replied: "Replied",
  hand_off: "The agent handed off",
  agent_off: "The agent was off",
  spend_cap: "Monthly spend cap reached",
  time_limit: "Took too long",
  step_limit: "Too many steps",
  context_window: "Conversation too long",
  refusal: "The model declined",
  max_tokens: "Reply too long",
  empty_reply: "No reply",
  conversation_closed: "Conversation already closed",
  not_evaluated: "Version not evaluated",
  error: "Something went wrong",
};

export function endReasonLabel(reason: string | null): string {
  if (!reason) return "";
  if (reason.startsWith("model_")) return "The model could not be reached";
  return END_REASONS[reason] ?? reason;
}

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Waiting", tone: "info" },
  approved: { label: "Approved, running", tone: "info" },
  executed: { label: "Done", tone: "success" },
  failed: { label: "Did not go through", tone: "danger" },
  rejected: { label: "Rejected", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};

export const DECISION_REASON_LABELS: Record<DecisionReason, string> = {
  not_needed: "Not needed",
  wrong_details: "Wrong details",
  unsafe: "Not safe",
  patient_declined: "The patient declined",
  duplicate: "Already done",
  edited: "Edited before approving",
  other: "Another reason",
};

/** Reasons someone picks when rejecting; "edited" is set by approving with changes. */
export const REJECT_REASONS: DecisionReason[] = ["not_needed", "wrong_details", "unsafe", "patient_declined", "duplicate", "other"];

export const MESSAGE_ROLE_LABELS: Record<AgentMessageRole, string> = {
  patient: "Patient",
  agent: "Agent",
  tool: "Tool results",
  staff: "Staff member",
  notice: "Notice",
};

/** Cents the API sends, as "$1,234.56". */
export const centsToMoney = (cents: number) => formatMoney(cents / 100);

/** "startsAt" as "Starts at": a field name from a tool's input, in words. */
export function fieldLabel(key: string): string {
  const words = key
    .replace(/Cents$/, "")
    .replace(/Id$/, " id")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A value from a tool's input as a person reads it: money in dollars, times in Australian format. */
export function fieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "Not set";
  if (typeof value === "number" && key.endsWith("Cents")) return centsToMoney(value);
  if (typeof value === "string" && ISO_TIME.test(value)) return formatDateTime(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
