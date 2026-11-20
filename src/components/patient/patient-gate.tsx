"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBrand } from "./brand-context";
import { ConfirmDateOfBirth } from "./confirm-date-of-birth";
import { BrandRow, PatientShell } from "./patient-shell";
import { usePatientSignOut } from "./sign-out";
import { usePatientMe } from "./use-patient";
import "@/styles/sections/patient.css";

/**
 * What has to be true before a patient sees their care: Clerk has a
 * session, the API knows them as a patient of this brand's tenant, and
 * this sign-in has confirmed their date of birth (ADR 0035).
 *
 * No session goes to sign-in. A session the API has no patient record for
 * is a sign-up that hasn't finished (PA7): it is not sent back to sign
 * in, which would loop. An API that can't be reached says so, with Try
 * again, and never looks like an empty account.
 */
export function PatientGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const me = usePatientMe(isLoaded && isSignedIn === true);
  const signOut = usePatientSignOut();
  const brand = useBrand();

  const sessionGone = me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    if ((isLoaded && !isSignedIn) || sessionGone) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [isLoaded, isSignedIn, sessionGone, pathname, router]);

  if (!isLoaded || !isSignedIn || me.isPending || sessionGone) return <GateSkeleton />;

  if (me.error) {
    const code = me.error instanceof ApiError ? me.error.code : null;
    if (code === "date_of_birth_needed") {
      return (
        <GateCard>
          <ConfirmDateOfBirth onSignOut={() => void signOut()} />
        </GateCard>
      );
    }
    const noRecord = code === "no_patient_record";
    return (
      <GateCard>
        <h1 className="gate-title">{noRecord ? "Finish setting up your account" : `${brand.name} is unavailable`}</h1>
        <p className="gate-text">
          {noRecord
            ? `You're signed in, but your ${brand.name} account isn't set up yet. Start with a few questions about you.`
            : "We couldn't load your account. Your sign-in worked, so this is a problem at our end. Nothing has changed."}
        </p>
        <div className="gate-actions">
          {noRecord ? (
            brand.status === "live" ? (
              <Link href="/start" className="btn btn-primary">
                Get started
              </Link>
            ) : null
          ) : (
            <Button onClick={() => void me.refetch()}>Try again</Button>
          )}
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
        {noRecord && brand.status === "paused" ? (
          <p className="gate-text">{brand.name} isn&apos;t taking new patients at the moment.</p>
        ) : null}
      </GateCard>
    );
  }

  return <PatientShell name={me.data.preferredName ?? me.data.givenName}>{children}</PatientShell>;
}

/** While the session is checked: the frame's own shape, so nothing jumps when the page arrives. */
function GateSkeleton() {
  return (
    <div className="pt" aria-busy="true" aria-label="Opening your account">
      <div className="pt-top">
        <div className="pt-top-in">
          <BrandRow />
          <Skeleton className="gate-skel-crumb" />
        </div>
      </div>
      <div className="pt-main">
        <div className="pt-page">
          <Skeleton className="gate-skel-title" />
          <Skeleton className="gate-skel-sub" />
        </div>
      </div>
    </div>
  );
}

export function GateCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate">
      <div className="gate-card" role="region" aria-label="Your account">
        <div className="gate-brand">
          <BrandRow />
        </div>
        {children}
      </div>
    </div>
  );
}
