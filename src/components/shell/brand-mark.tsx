/**
 * Medora's mark: an "M" drawn as one line on the primary tile, in
 * `currentColor`, so it stays crisp at any size and follows the theme.
 *
 * - `BrandMark`: the app icon, the mark on a rounded primary tile (the
 *   sidebar's brand row, the sign-in screens).
 * - `BrandLogo`: the mark and the word "Medora" side by side.
 *
 * A tenant's own brand (ADR 0023) shows on its patient pages, never here:
 * the staff console is Medora's.
 */

const M = "M9.5 22V10.5l6.5 8 6.5-8V22";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className ? `sb-logo ${className}` : "sb-logo"} aria-hidden>
      <svg viewBox="0 0 32 32" focusable="false">
        <path d={M} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg className={className ? `brand-logo ${className}` : "brand-logo"} viewBox="0 0 124 32" role="img" aria-label="Medora">
      <rect width="32" height="32" rx="9.5" fill="currentColor" />
      <path d={M} fill="none" stroke="var(--card)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="42" y="23" fill="currentColor" fontFamily="var(--font-sans)" fontSize="20" fontWeight="600" letterSpacing="-0.4">
        Medora
      </text>
    </svg>
  );
}
