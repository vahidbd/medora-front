/**
 * One formatter per kind of value, all Australian: "$1,234.56" in AUD,
 * "15 Nov 2026", "15 Nov 2026, 14:05". A missing value formats as an empty
 * string, never a dash: a table cell stays blank and a facts table says
 * "Not set" (DESIGN.md: no em dash in anything a person reads). Amounts
 * the API sends are cents (ADR 0016): convert them where they arrive, once.
 */
export const EMPTY = "";

const audFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const numberFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return EMPTY;
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return audFormatter.format(noNegativeZero(n));
}

/** Anything that rounds to 0.00 reads as 0.00, never "-$0.00". */
function noNegativeZero(n: number): number {
  return Math.abs(n) < 0.005 ? 0 : n;
}

/** Plain 1,234.56 without the currency symbol (for statement/ledger columns). */
export function formatAmount(value: number | string | null | undefined): string {
  if (value == null || value === "") return EMPTY;
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return numberFormatter.format(noNegativeZero(n));
}

// Fixed three-letter months: ICU's en-AU gives "Sept" and "July", the kit
// writes "Sep" and "Jul".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "15 Nov 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return EMPTY;
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** A calendar date ("1988-05-14") as "14 May 1988", read as written: it has no time zone to shift it a day. */
export function formatCalendarDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return value ? String(value) : EMPTY;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** "15 Nov 2026, 14:05". */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return EMPTY;
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mm}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return EMPTY;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
