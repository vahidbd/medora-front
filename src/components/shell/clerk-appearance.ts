/**
 * Clerk's sign-in and sign-up cards in the Grid kit's tokens, so they
 * follow the light and dark themes with the rest of Medora.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorForeground: "var(--foreground)",
    colorMutedForeground: "var(--muted-foreground)",
    colorMuted: "var(--muted)",
    colorBackground: "var(--card)",
    colorInput: "var(--background)",
    colorInputForeground: "var(--foreground)",
    colorBorder: "var(--border)",
    colorNeutral: "var(--foreground)",
    colorRing: "var(--ring)",
    colorDanger: "var(--destructive)",
    colorShadow: "var(--foreground)",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "shadow-none border-0 p-0 bg-transparent",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    footer: "bg-transparent",
  },
};
