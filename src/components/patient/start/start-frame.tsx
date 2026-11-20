"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { BrandRow } from "@/components/patient/patient-shell";
import { usePatientSignOut } from "@/components/patient/sign-out";
import "@/styles/sections/patient.css";
import "@/styles/sections/patient-start.css";

/**
 * The start flow's frame: the brand's row, and a way to sign in that comes
 * back to the same page, or to sign out once signed in. No tabs: nothing
 * behind them exists for someone who hasn't an account yet.
 */
export function StartFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const signOut = usePatientSignOut();
  return (
    <div className="pt">
      <header className="pt-top">
        <div className="pt-top-in">
          <BrandRow />
          {isLoaded && !isSignedIn ? (
            <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="btn btn-ghost btn-sm">
              Sign in
            </Link>
          ) : null}
          {isLoaded && isSignedIn ? (
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          ) : null}
        </div>
      </header>
      <main className="pt-main" id="main">
        {children}
      </main>
    </div>
  );
}
