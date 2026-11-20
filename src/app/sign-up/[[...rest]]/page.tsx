import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { BrandLogo } from "@/components/shell/brand-mark";
import { clerkAppearance } from "@/components/shell/clerk-appearance";

export const metadata: Metadata = { title: "Accept your invitation" };

/**
 * Where an invitation email lands (docs/decisions/admin.md ADM5). Clerk
 * reads the invitation from the link and makes the sign-in account; sign-up
 * is restricted to invitations in Clerk, so this page can't be used without
 * one. Medora itself decides what the account may do: the membership
 * becomes active on the first sign-in, if the invitation is still open.
 * Two-step sign-in is set up next, in the console's gate.
 */
export default function SignUpPage() {
  return (
    <main className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <BrandLogo />
        </div>
        <h1 className="gate-title">Accept your invitation</h1>
        <p className="gate-text">Choose how you will sign in to Medora. You will set up two-step sign-in next.</p>
        <SignUp appearance={clerkAppearance} forceRedirectUrl="/home" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
