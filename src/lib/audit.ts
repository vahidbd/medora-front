import type { AuditEntry, AuditFilter, DataZone } from "@/lib/api/types";
import { toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { ZONE_LABELS } from "@/lib/roles";

/**
 * The audit log screen's filters and how entries read (docs/decisions/admin.md
 * ADM25 to ADM27). Dates are whole days in your own time zone (ADM27), sent
 * to the API as instants: From is the start of its day, To the start of the
 * day after, so both days are included.
 */
export type AuditFilters = {
  /** A day, YYYY-MM-DD. */
  fromDay: string;
  toDay: string;
  actorId: string;
  action: string;
  zone: DataZone | "";
  recordId: string;
};

export const NO_FILTERS: AuditFilters = { fromDay: "", toDay: "", actorId: "", action: "", zone: "", recordId: "" };

/** The start of a YYYY-MM-DD day in this browser's time zone, `days` later. */
function startOf(day: string, days = 0): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d! + days).toISOString();
}

export function toApiFilter(filters: AuditFilters): AuditFilter {
  const filter: AuditFilter = {};
  if (filters.fromDay) filter.from = startOf(filters.fromDay);
  if (filters.toDay) filter.to = startOf(filters.toDay, 1);
  if (filters.actorId) filter.actorId = filters.actorId;
  if (filters.action.trim()) filter.action = filters.action.trim();
  if (filters.zone) filter.zone = filters.zone;
  if (filters.recordId.trim()) filter.recordId = filters.recordId.trim();
  return filter;
}

/** The filters set, as the pills under the header show them, each with the field it clears. */
export function filterPills(
  filters: AuditFilters,
  personName: (userId: string) => string,
): { key: keyof AuditFilters; label: string; value: string }[] {
  const dayOf = (day: string) => formatDate(new Date(startOf(day)));
  const pills: { key: keyof AuditFilters; label: string; value: string }[] = [];
  if (filters.fromDay) pills.push({ key: "fromDay", label: "From", value: dayOf(filters.fromDay) });
  if (filters.toDay) pills.push({ key: "toDay", label: "To", value: dayOf(filters.toDay) });
  if (filters.actorId) pills.push({ key: "actorId", label: "Person", value: personName(filters.actorId) });
  if (filters.action.trim()) pills.push({ key: "action", label: "Action", value: filters.action.trim() });
  if (filters.zone) pills.push({ key: "zone", label: "Zone", value: ZONE_LABELS[filters.zone] });
  if (filters.recordId.trim()) pills.push({ key: "recordId", label: "Record", value: filters.recordId.trim() });
  return pills;
}

/** Who did it: the person's name, or what kind of actor it was. */
export function actorLabel(entry: AuditEntry): string {
  if (entry.actorType === "agent") return "Agent";
  if (entry.actorType === "system") return "Medora";
  return entry.actorName ?? "Someone outside this tenant";
}

/** An entry's facts on one line: `changed: priceCents, priceBefore: 8900`. */
export function detailsText(entry: AuditEntry): string {
  return Object.entries(entry.details)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

const CSV_HEADER = ["Time (UTC)", "Who", "Actor type", "Actor id", "Action", "Zone", "Record table", "Record id", "Request id", "Details"];

/** The export as a CSV file's text, newest first, times in UTC as the API gives them. */
export function auditCsv(entries: readonly AuditEntry[]): string {
  return toCsv(
    CSV_HEADER,
    entries.map((entry) => [
      entry.at,
      actorLabel(entry),
      entry.actorType,
      entry.actorId,
      entry.action,
      entry.zone,
      entry.recordTable,
      entry.recordId,
      entry.requestId,
      detailsText(entry),
    ]),
  );
}

/** `audit-log-2026-11-20.csv`, dated today in your own time zone. */
export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `audit-log-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}
