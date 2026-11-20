/*
 * A brand's one colour on its patient pages (docs/decisions/patient-app.md
 * PA4). It replaces the kit's primary (buttons, the current tab, the
 * unread count) only when its text reaches WCAG AA, 4.5:1, against it;
 * otherwise the kit's own primary stays. The same colour is used in light
 * and dark, so the check doesn't depend on the theme. Status colours never
 * change.
 */

const HEX = /^#([0-9a-f]{6})$/i;

/** The kit's two ink colours a filled button can carry (grid-tokens.css --primary-foreground, light and dark). */
const LIGHT_INK = "#ffffff";
const DARK_INK = "#0a0a0a";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface BrandColours {
  primary: string;
  foreground: string;
  /** The hover fill: the same hue, 8% toward the ink. */
  hover: string;
}

function mix(hex: string, toward: string, amount: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const part = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${[16, 8, 0].map((shift) => part(shift).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The colours to use for a brand's primary, or null to keep the kit's: when
 * the brand has none, it isn't a #rrggbb colour, or neither ink reaches 4.5:1 on it.
 */
export function brandColours(primaryColour: string | null | undefined): BrandColours | null {
  if (!primaryColour || !HEX.test(primaryColour)) return null;
  const primary = primaryColour.toLowerCase();
  const light = contrastRatio(primary, LIGHT_INK);
  const dark = contrastRatio(primary, DARK_INK);
  const foreground = light >= dark ? LIGHT_INK : DARK_INK;
  if (Math.max(light, dark) < 4.5) return null;
  return { primary, foreground, hover: mix(primary, foreground === LIGHT_INK ? DARK_INK : LIGHT_INK, 0.12) };
}

/** The style rule that puts a brand's colours over the kit's, in both themes. Only validated hex values reach it. */
export function brandStyleRule(colours: BrandColours): string {
  return `html:root,html.dark{--primary:${colours.primary};--primary-foreground:${colours.foreground};--primary-hover:${colours.hover};}`;
}
