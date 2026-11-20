import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "info" | "accent" | "danger" | "neutral";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "badge-success",
  warning: "badge-warning",
  info: "badge-info",
  accent: "badge-accent",
  danger: "badge-danger",
  neutral: "badge-neutral",
};

/**
 * The kit's status pill: 24 tall, a 6px dot and 12.5/500 text on one of six
 * soft tones. Colour is the second channel; the label always says it. Each
 * screen maps its API values to a label and a tone in one place, so a value
 * is never shown raw.
 */
export function StatusBadge({
  label,
  tone = "neutral",
  size = "default",
  dot = true,
  className,
}: {
  label: string;
  tone?: StatusTone;
  /** "sm" is the kit's 20px badge, for dense rows and menus. */
  size?: "default" | "sm";
  dot?: boolean;
  className?: string;
}) {
  return <span className={cn("badge", TONE_CLASS[tone], dot && "badge-dot", size === "sm" && "badge-sm", className)}>{label}</span>;
}
