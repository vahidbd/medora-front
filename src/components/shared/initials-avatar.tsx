import { cn } from "@/lib/utils";

/**
 * The kit's avatar: always a circle. Initials sit on one of the soft status
 * pastels with its matching ink, picked by hashing the name so a person
 * keeps their colour everywhere. Never the near-black primary.
 */
const PASTELS = [
  ["var(--status-info-bg)", "var(--status-info-fg)"],
  ["var(--status-success-bg)", "var(--status-success-fg)"],
  ["var(--status-warning-bg)", "var(--status-warning-fg)"],
  ["var(--status-accent-bg)", "var(--status-accent-fg)"],
  ["var(--status-danger-bg)", "var(--status-danger-fg)"],
  ["var(--status-neutral-bg)", "var(--status-neutral-fg)"],
] as const;

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** The pastel and its ink for a seed. */
function pastelOf(seed: string): readonly [string, string] {
  return PASTELS[hash(seed) % PASTELS.length] ?? PASTELS[0];
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function InitialsAvatar({
  name,
  size = 32,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [bg, fg] = pastelOf(name || "?");
  return (
    <span
      className={cn("ava", className)}
      style={
        {
          "--ava": `${size}px`,
          background: bg,
          color: fg,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
