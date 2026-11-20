"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { patientKey } from "@/lib/api/patient";
import { patientIntakeApi } from "@/lib/api/start";
import type { IntakeStartScreen, IntakeView } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/components/patient/brand-context";
import { ConfirmDateOfBirth } from "@/components/patient/confirm-date-of-birth";
import { usePatientSignOut } from "@/components/patient/sign-out";
import { CardLoading, LoadFailed } from "@/components/patient/states";
import { usePatientMe } from "@/components/patient/use-patient";
import { AboutYou } from "./about-you";
import { CareConsents } from "./care-consents";
import { IntakeSteps, messageFor } from "./intake-steps";
import { ReviewAndSend, Sent } from "./review";
import { StartClosed } from "./start-closed";
import { UnderAgeNotice } from "./stop-notice";
import { useClaimHeld } from "./use-claim";

/**
 * A program's intake once signed in (docs/decisions/patient-start.md
 * JOIN11 to JOIN14): an account if there isn't one yet, the date of birth
 * on a new sign-in, then what this browser started is claimed, the care
 * consents are agreed, and the patient's own intake for the program is
 * answered, checked and sent. Every call goes through the relay to
 * /v1/patient/*, except creating the account and claiming (ADR 0280).
 */
export function SignedInStart({ programId, screen }: { programId: string; screen: IntakeStartScreen }) {
  const me = usePatientMe();
  const signOut = usePatientSignOut();
  const pathname = usePathname();
  const claim = useClaimHeld(me.isSuccess);
  const [ended, setEnded] = useState<"under_age" | "closed" | null>(null);
  const refetchMe = me.refetch;
  const recheck = useCallback(() => void refetchMe(), [refetchMe]);

  const page = (children: React.ReactNode) => (
    <div className="pt-page st-page">
      <div className="pt-head">
        <h1 className="pt-title">{screen.programName}</h1>
      </div>
      {children}
    </div>
  );

  if (ended === "closed") return <StartClosed />;
  if (ended === "under_age") return page(<UnderAgeNotice />);
  if (me.isPending) return page(<CardLoading label="Loading your account" />);
  if (me.isError) {
    const code = me.error instanceof ApiError ? me.error.code : null;
    if (code === "no_patient_record") {
      return page(<AboutYou onCreated={recheck} onOutcome={(outcome) => (outcome === "registered" ? recheck() : setEnded(outcome))} />);
    }
    if (code === "date_of_birth_needed") {
      // The check is the page's only heading until it passes.
      return (
        <div className="pt-page st-page">
          <section className="pt-card">
            <ConfirmDateOfBirth onSignOut={() => void signOut()} />
          </section>
        </div>
      );
    }
    if (me.error instanceof ApiError && me.error.status === 401) {
      return page(
        <section className="pt-card st-message">
          <h2 className="pt-card-title">Your sign-in has ended</h2>
          <div className="pt-card-actions">
            <Link href={`/sign-in?next=${encodeURIComponent(pathname)}`} className="btn btn-primary">
              Sign in again
            </Link>
          </div>
        </section>,
      );
    }
    return page(<LoadFailed what="your account" onRetry={recheck} />);
  }
  if (claim.isPending) return page(<CardLoading label="Loading your answers" />);
  if (claim.isError) return page(<LoadFailed what="your answers" onRetry={() => void claim.refetch()} />);
  if (me.data.consentsNeeded.length > 0) return page(<CareConsents onAgreed={recheck} />);
  return <PatientIntake programId={programId} screen={screen} onConsentNeeded={recheck} onClosed={() => setEnded("closed")} />;
}

/** The patient's intake for the program: the one in progress, or a new one when they choose to start. */
function PatientIntake({
  programId,
  screen,
  onConsentNeeded,
  onClosed,
}: {
  programId: string;
  screen: IntakeStartScreen;
  onConsentNeeded: () => void;
  onClosed: () => void;
}) {
  const { host } = useBrand();
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<string | null>(null);
  const list = useQuery({ queryKey: patientKey(host, "intakes"), queryFn: patientIntakeApi.list, retry: false });
  const mine = (list.data?.intakes ?? []).filter((intake) => intake.programId === programId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const intakeId = chosen ?? mine.find((intake) => intake.status === "in_progress")?.intakeId ?? null;
  const view = useQuery({
    queryKey: patientKey(host, "intakes", intakeId),
    queryFn: () => patientIntakeApi.read(intakeId!),
    enabled: intakeId !== null,
    retry: false,
  });
  const keep = (next: IntakeView) => queryClient.setQueryData(patientKey(host, "intakes", next.intakeId), next);

  const start = useMutation({
    mutationFn: () => patientIntakeApi.start(programId),
    onSuccess: (started) => {
      keep(started);
      setChosen(started.intakeId);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "consent_needed") onConsentNeeded();
      else if (e instanceof ApiError && (e.code === "brand_not_accepting" || e.code === "program_unavailable" || e.code === "tenant_not_ready")) onClosed();
    },
  });

  // An intake started on this device with another date of birth can't be shown or carried on (INT17).
  const differs = view.error instanceof ApiError && view.error.code === "date_of_birth_differs";

  const page = (children: React.ReactNode, lede?: string) => (
    <div className="pt-page st-page">
      <div className="pt-head">
        <h1 className="pt-title">{screen.programName}</h1>
        {lede ? <p className="pt-lede">{lede}</p> : null}
      </div>
      {children}
    </div>
  );

  if (list.isPending || (intakeId && view.isPending)) return page(<CardLoading label="Loading your answers" />);
  if (list.isError) return page(<LoadFailed what="your answers" onRetry={() => void list.refetch()} />);
  if (intakeId && view.isError && !differs) return page(<LoadFailed what="your answers" onRetry={() => void view.refetch()} />);

  if (!intakeId || differs || !view.data) {
    const sentBefore = mine.some((intake) => intake.status === "completed");
    return page(
      <section className="pt-card" aria-labelledby="intake-intro">
        {differs ? <Alert variant="info">Answers started on this device with a different date of birth can&apos;t be shown here, so this starts again.</Alert> : null}
        <div>
          <h2 className="pt-card-title" id="intake-intro">
            A few questions about your health
          </h2>
          <p className="pt-card-sub">A clinician reviews your answers before any treatment. They&apos;re saved as you go.</p>
        </div>
        {sentBefore ? <p className="pt-text">You&apos;ve already sent answers for this program. Start again only if something has changed.</p> : null}
        {start.isError && !(start.error instanceof ApiError && start.error.code === "consent_needed") ? (
          <p className="pt-error" role="alert">
            {messageFor(start.error)}
          </p>
        ) : null}
        <div className="pt-card-actions">
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            {sentBefore ? "Start again" : "Start"}
          </Button>
        </div>
      </section>,
    );
  }

  const current = view.data;
  return page(
    <IntakeSteps
      view={current}
      save={async (stepKey, answers) => {
        const next = await patientIntakeApi.answer(current.intakeId, stepKey, answers);
        keep(next);
        return next;
      }}
      ready={(change) =>
        current.status === "completed" ? (
          <Sent />
        ) : (
          <ReviewAndSend
            view={current}
            onChange={change}
            onConsentNeeded={onConsentNeeded}
            send={async () => {
              const sent = await patientIntakeApi.submit(current.intakeId);
              keep(sent);
              // Stay on this intake once the list no longer has it in progress.
              setChosen(sent.intakeId);
              void queryClient.invalidateQueries({ queryKey: patientKey(host, "intakes"), exact: true });
              return sent;
            }}
          />
        )
      }
    />,
    current.status === "in_progress" && current.currentStep ? "Your answers are saved as you go." : undefined,
  );
}
