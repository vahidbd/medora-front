/**
 * The kit's motion, for the few places that animate from script (Web
 * Animations are not covered by the stylesheet's reduced-motion rule).
 * Durations come from the tokens (--dur-quick, --dur-fast, --dur-medium),
 * so script and CSS never drift apart.
 */

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const FALLBACK_MS: Record<string, number> = {
  "--dur-micro": 80,
  "--dur-quick": 150,
  "--dur-fast": 250,
  "--dur-medium": 350,
};

/** A duration token in milliseconds ("--dur-fast" → 250). */
export function motionMs(token: "--dur-micro" | "--dur-quick" | "--dur-fast" | "--dur-medium"): number {
  if (typeof document === "undefined") return FALLBACK_MS[token] ?? 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return FALLBACK_MS[token] ?? 0;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}

/** The kit's --ease-out, read from the tokens. */
export function motionEase(): string {
  if (typeof document === "undefined") return "ease-out";
  return getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
}
