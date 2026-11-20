"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { patientKey } from "@/lib/api/patient";
import { startApi } from "@/lib/api/start";
import type { IntakeStartScreen, IntakeView } from "@/lib/api/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { parseTypedDate } from "@/components/ui/date-field";
import { useBrand } from "@/components/patient/brand-context";
import { CardLoading, LoadFailed } from "@/components/patient/states";
import { IntakeSteps } from "./intake-steps";

/**
 * A program's intake before an account (docs/decisions/intake.md INT5 in
 * medora-backend): the first screen with the privacy notice, the age
 * confirmation and the date of birth; then the steps; then an account to
 * send the answers to a clinician. An intake this browser already holds for
 * the program is picked up where it was left (JOIN7). Every call goes
 * through /api/start/*, which holds the resume token (ADR 0280).
 */

/** Why a held intake can't be picked up: nothing to come back to (JOIN4). */
const GONE = new Set(["unclaimed", "expired", "version_withdrawn"]);

export function StartFlow({ programId, screen, heldIntakeId }: { programId: string; screen: IntakeStartScreen; heldIntakeId: string | null }) {
  const { host } = useBrand();
  const queryClient = useQueryClient();
  const [intakeId, setIntakeId] = useState(heldIntakeId);
  const held = useQuery({
    queryKey: patientKey(host, "start", intakeId),
    queryFn: () => startApi.read(intakeId!),
    enabled: intakeId !== null,
    retry: false,
  });

  const view = held.data;
  const gone =
    (held.error instanceof ApiError && held.error.status === 404) || (view?.status === "ended" && view.endedReason !== null && GONE.has(view.endedReason));

  if (intakeId && held.isPending) return <CardLoading label="Loading your answers" />;
  if (intakeId && held.isError && !gone) return <LoadFailed what="your answers" onRetry={() => void held.refetch()} />;
  if (!view || gone) {
    return (
      <StartScreen
        screen={screen}
        lapsed={gone}
        onStarted={(started) => {
          queryClient.setQueryData(patientKey(host, "start", started.intakeId), started);
          setIntakeId(started.intakeId);
        }}
      />
    );
  }

  return (
    <div className="pt-page st-page">
      <div className="pt-head">
        <h1 className="pt-title">{view.programName}</h1>
        {view.status === "in_progress" ? <p className="pt-lede">Your answers are saved as you go, on this device, for 14 days.</p> : null}
      </div>
      {heldIntakeId === view.intakeId && view.status === "in_progress" ? <p className="pt-muted">We kept your earlier answers, so you can carry on.</p> : null}
      <IntakeSteps
        view={view}
        save={async (stepKey, answers) => {
          const next = await startApi.answer(view.intakeId, stepKey, answers);
          queryClient.setQueryData(patientKey(host, "start", view.intakeId), next);
          return next;
        }}
        ready={(change) => <ReadyToSend programId={programId} onChange={() => change()} />}
      />
    </div>
  );
}

/** The first screen: the privacy notice to agree to, the age confirmation and the date of birth, before any health question. */
function StartScreen({ screen, lapsed, onStarted }: { screen: IntakeStartScreen; lapsed: boolean; onStarted: (view: IntakeView) => void }) {
  const brand = useBrand();
  const router = useRouter();
  const id = useId();
  const [agreed, setAgreed] = useState(false);
  const [adult, setAdult] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  const start = useMutation({
    mutationFn: startApi.start,
    onSuccess: onStarted,
    onError: (e) => {
      // A newer notice was published since this page loaded: show it, unticked.
      if (e instanceof ApiError && e.code === "not_current_version") {
        setAgreed(false);
        router.refresh();
      }
      fail(startMessage(e));
    },
  });

  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!agreed) return fail("Read the privacy notice and tick to agree, to go on.");
    if (!adult) return fail("Tick to confirm you're 18 or older.");
    const typed = parseTypedDate(dateOfBirth);
    if (!typed) return fail("Enter your date of birth as day, month and year, like 14/05/1990.");
    start.mutate({ programId: screen.programId, privacyDocumentId: screen.privacyNotice.documentId, adult: true, dateOfBirth: typed });
  }

  const paragraphs = screen.privacyNotice.body.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div className="pt-page st-page">
      <div className="pt-head">
        <h1 className="pt-title">{screen.programName}</h1>
        <p className="pt-lede">A few questions about you and your health. A clinician reviews your answers before any treatment.</p>
      </div>
      {lapsed ? <Alert variant="info">Your earlier answers on this device weren&apos;t kept, so this starts again.</Alert> : null}
      <section className="pt-card" aria-labelledby={`${id}-title`}>
        <div>
          <h2 className="pt-card-title" id={`${id}-title`}>
            Before you start
          </h2>
          <p className="pt-card-sub">Read how {brand.name} looks after your information.</p>
        </div>
        <div className="st-notice" role="region" aria-labelledby={`${id}-notice`} tabIndex={0}>
          <h3 className="st-notice-title" id={`${id}-notice`}>
            {screen.privacyNotice.title}
          </h3>
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <form className="pt-form" onSubmit={submit} noValidate>
          <label className="st-check">
            <Checkbox checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} />
            <span>I&apos;ve read the privacy notice, and I agree to {brand.name} collecting my health information to assess and provide my care.</span>
          </label>
          <label className="st-check">
            <Checkbox checked={adult} onCheckedChange={(checked) => setAdult(checked === true)} />
            <span>I&apos;m 18 or older.</span>
          </label>
          <div className="pt-field">
            <label className="pt-label" htmlFor={`${id}-dob`}>
              Date of birth
            </label>
            <p className="pt-hint" id={`${id}-dob-hint`}>
              Day, month and year, like 14/05/1990
            </p>
            <Input
              id={`${id}-dob`}
              className="st-dob"
              inputMode="numeric"
              autoComplete="bday"
              maxLength={20}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              aria-describedby={`${id}-dob-hint`}
            />
          </div>
          {error ? (
            <p className="pt-error" role="alert" ref={errorRef} tabIndex={-1}>
              {error}
            </p>
          ) : null}
          <div className="pt-card-actions">
            <Button type="submit" disabled={start.isPending}>
              Start
            </Button>
          </div>
          <p className="pt-hint">Your answers are saved as you go, on this device, for 14 days.</p>
        </form>
      </section>
    </div>
  );
}

/** Every step is done: an account sends the answers to a clinician (JOIN6). Signing in also signs up (APP5). */
function ReadyToSend({ programId, onChange }: { programId: string; onChange: () => void }) {
  return (
    <section className="pt-card" aria-labelledby="intake-ready">
      <div>
        <h2 className="pt-card-title" id="intake-ready">
          Your answers are ready to send
        </h2>
        <p className="pt-card-sub">
          Create your account to send them to a clinician. We email you a code to sign in, and it takes a minute. Already have an account? Sign in with
          the same email.
        </p>
      </div>
      <div className="pt-card-actions">
        <Link href={`/sign-in?next=${encodeURIComponent(`/start/${programId}`)}`} className="btn btn-primary">
          Create your account
        </Link>
        <Button variant="outline" onClick={onChange}>
          Change your answers
        </Button>
      </div>
    </section>
  );
}

function startMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "We couldn't start just now. Try again.";
  switch (error.code) {
    case "not_current_version":
      return "The privacy notice has just changed. Read the new one, then tick to agree again.";
    case "brand_not_accepting":
    case "tenant_not_ready":
    case "program_unavailable":
    case "privacy_notice_missing":
      return "This isn't taking new patients right now.";
    case "too_many_requests":
      return "That's too many tries for now. Wait a few minutes, then try again.";
    default:
      return error.status === 400 ? "Check your date of birth: day, month and year, like 14/05/1990." : "We couldn't start just now. Try again.";
  }
}
