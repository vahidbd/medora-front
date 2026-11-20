import type { StatusTone } from "@/components/shared/status-badge";
import type { Membership, StaffMember } from "@/lib/api/types";
import { MEMBERSHIP_STATUS } from "@/lib/roles";

/**
 * Where a staff member's membership stands, as the API decides it
 * (docs/decisions/admin.md ADM5, ADM7): an invitation works for 14 days,
 * and a membership with an end date stops working at that instant. The
 * status alone doesn't say either, so the screens work it out here, once.
 */
export type AccessState = "active" | "paused" | "invited" | "invitation_expired" | "ended";

const STATES: Record<AccessState, { label: string; tone: StatusTone }> = {
  active: MEMBERSHIP_STATUS.active,
  paused: MEMBERSHIP_STATUS.suspended,
  invited: MEMBERSHIP_STATUS.invited,
  invitation_expired: { label: "Invitation expired", tone: "warning" },
  ended: { label: "Ended", tone: "neutral" },
};

const passed = (iso: string | null, now: number) => iso !== null && new Date(iso).getTime() <= now;

export function accessStateOf(member: Pick<StaffMember, "status" | "expiresAt" | "invitationExpiresAt">, now = Date.now()): AccessState {
  if (member.status === "invited") return passed(member.invitationExpiresAt, now) ? "invitation_expired" : "invited";
  if (passed(member.expiresAt, now)) return "ended";
  return member.status === "active" ? "active" : "paused";
}

export function accessLabel(state: AccessState): { label: string; tone: StatusTone } {
  return STATES[state];
}

/** A membership the console can work in: active, and not past its end date. */
export function isUsable(membership: Pick<Membership, "status" | "expiresAt">, now = Date.now()): boolean {
  return membership.status === "active" && !passed(membership.expiresAt, now);
}

/**
 * An end date picked as a day (YYYY-MM-DD) becomes the end of that day in
 * this browser's time zone, sent as an instant. Tenant time zones (ADR
 * 0017) arrive with tenant settings; until then, the person's own clock.
 */
export function endOfDay(isoDate: string): string {
  const [year = 1970, month = 1, day = 1] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

/** The day an end date falls on, for a date field. */
export function dayOf(instant: string | null): string {
  if (!instant) return "";
  const d = new Date(instant);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
