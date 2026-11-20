import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { BrandLogo } from "@/components/shell/brand-mark";
import { clerkAppearance } from "@/components/shell/clerk-appearance";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Clerk owns sign-in. The catch-all segment lets it route its own steps
 * (verification, a second factor, a reset) under /sign-in instead of
 * sending the browser to a hosted page. Its card wears the Grid kit's
 * tokens, so it follows the light and dark themes with the rest of Medora.
 * New staff come by invitation only: the invitation email opens /sign-up.
 */

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
        <SignIn appearance={clerkAppearance} forceRedirectUrl={next} withSignUp={false} />
      </div>
    </main>
  );
}
