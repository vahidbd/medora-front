import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { BrandLogo } from "@/components/shell/brand-mark";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Clerk owns sign-in. The catch-all segment lets it route its own steps
 * (verification, a second factor, a reset) under /sign-in instead of
 * sending the browser to a hosted page. Its card wears the Grid kit's
 * tokens, so it follows the light and dark themes with the rest of Medora.
 * New staff come by invitation only; there is no sign-up.
 */
const appearance = {
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

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <BrandLogo />
        </div>
        <h1 className="gate-title">Sign in</h1>
        <p className="gate-text">Use your work account to open Medora.</p>
        <SignIn appearance={appearance} forceRedirectUrl={next} withSignUp={false} />
      </div>
    </main>
  );
}
