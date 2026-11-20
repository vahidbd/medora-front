"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { patientApi } from "@/lib/api/patient";
import type { CheckIn, CheckInSubmission, MissedDoses } from "@/lib/api/types";
import { nextCheckIn } from "@/lib/check-in-due";
import { formatCalendarDay } from "@/lib/format";
import { kindsToTrack } from "@/lib/measurement-kinds";
import { dateIn } from "@/lib/patient-time";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBrand } from "@/components/patient/brand-context";
import { CardLoading, LoadFailed } from "@/components/patient/states";
import {
  EmergencyNote,
  NO_SIDE_EFFECT,
  ReadingFields,
  SideEffectFields,
  readingsFrom,
  sideEffectFrom,
  trackingErrorMessage,
  type ReadingValues,
} from "@/components/patient/tracking-fields";
import { useSignedInPatient } from "@/components/patient/use-patient";
import { useCheckIns, useTrackingRefresh } from "@/components/patient/use-tracking";

/**
 * A check-in (ADH-02, docs/decisions/tracking.md TRK5 in medora-backend): a
 * few answers, written all together or not at all. No free-text note:
 * anything else goes to Messages, which a person answers.
 */

const MISSED: readonly { value: MissedDoses; label: string; listed: string }[] = [
  { value: "none", label: "No, none", listed: "No missed doses" },
  { value: "some", label: "Yes, a few", listed: "Missed a few doses" },
  { value: "most", label: "Yes, most of them", listed: "Missed most doses" },
];

const FEELINGS = ["Very unwell", "Not great", "Okay", "Good", "Very good"] as const;

export function PatientCheckInPage() {
  const me = useSignedInPatient();
  const brand = useBrand();
  const timeZone = me.timeZone ?? brand.timeZone;
  const [done, setDone] = useState<CheckIn | null>(null);
  const next = done ? nextCheckIn({ programs: me.programs, lastSubmittedAt: done.submittedAt, createdAt: me.createdAt, timeZone, now: new Date() }) : null;
  return (
    <div className="pt-page">
      <div className="pt-head">
        <h1 className="pt-title">Check in</h1>
        <p className="pt-lede">A few questions about how your treatment is going. It takes a minute.</p>
      </div>
      {done ? (
        <CheckInSent name={me.preferredName ?? me.givenName} severe={done.sideEffect?.severity === "severe"} nextDue={next?.dueOn ?? null} />
      ) : (
        <CheckInForm kinds={kindsToTrack(me.programs, [])} timeZone={timeZone} onSent={setDone} />
      )}
      <PastCheckIns />
    </div>
  );
}

function CheckInForm({ kinds, timeZone, onSent }: { kinds: ReturnType<typeof kindsToTrack>; timeZone: string; onSent: (checkIn: CheckIn) => void }) {
  const id = useId();
  const refresh = useTrackingRefresh();
  const [missedDoses, setMissedDoses] = useState<MissedDoses | "">("");
  const [feeling, setFeeling] = useState("");
  const [readings, setReadings] = useState<ReadingValues>({});
  const [hasSideEffect, setHasSideEffect] = useState<"no" | "yes" | "">("");
  const [sideEffect, setSideEffect] = useState(NO_SIDE_EFFECT);
  const [error, setError] = useState<string | null>(null);

  const submitCheckIn = useMutation({
    mutationFn: patientApi.submitCheckIn,
    onSuccess: async (checkIn) => {
      onSent(checkIn);
      await refresh();
    },
    onError: (e) => setError(trackingErrorMessage(e)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!missedDoses) return setError("Say whether you've missed any doses.");
    if (!feeling) return setError("Choose how you've been feeling.");
    const typed = readingsFrom(kinds, readings);
    if ("error" in typed) return setError(typed.error);
    const body: CheckInSubmission = { missedDoses, feeling: Number(feeling) };
    if (typed.readings.length > 0) body.readings = typed.readings;
    if (hasSideEffect === "yes") {
      const reported = sideEffectFrom(sideEffect);
      if ("error" in reported) return setError(reported.error);
      body.sideEffect = reported.sideEffect;
    }
    submitCheckIn.mutate(body);
  }

  return (
    <section className="pt-card" aria-label="Your check-in">
      <form className="pt-form" onSubmit={submit} noValidate>
        <div className="pt-field">
          <span className="pt-label" id={`${id}-missed`}>
            Since your last check-in, have you missed any doses?
          </span>
          <RadioGroup value={missedDoses} onValueChange={(v) => setMissedDoses(v as MissedDoses)} aria-labelledby={`${id}-missed`} className="pt-choices">
            {MISSED.map((option) => (
              <label key={option.value} className="pt-choice">
                <RadioGroupItem value={option.value} />
                <span>{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="pt-field">
          <span className="pt-label" id={`${id}-feeling`}>
            How have you been feeling overall?
          </span>
          <RadioGroup value={feeling} onValueChange={(v) => setFeeling(String(v))} aria-labelledby={`${id}-feeling`} className="pt-choices">
            {FEELINGS.map((label, index) => (
              <label key={label} className="pt-choice">
                <RadioGroupItem value={String(index + 1)} />
                <span>{label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        {kinds.length > 0 ? (
          <fieldset className="pt-fieldset">
            <legend className="pt-label">Measurements (optional)</legend>
            <p className="pt-hint">If you measured today, add them here. Leave blank anything you didn&apos;t measure.</p>
            <ReadingFields kinds={kinds} values={readings} onChange={(kind, value) => setReadings((v) => ({ ...v, [kind]: value }))} />
          </fieldset>
        ) : null}
        <div className="pt-field">
          <span className="pt-label" id={`${id}-effects`}>
            Any side effects you haven&apos;t told us about?
          </span>
          <RadioGroup value={hasSideEffect} onValueChange={(v) => setHasSideEffect(v === "yes" ? "yes" : "no")} aria-labelledby={`${id}-effects`} className="pt-choices">
            <label className="pt-choice">
              <RadioGroupItem value="no" />
              <span>No</span>
            </label>
            <label className="pt-choice">
              <RadioGroupItem value="yes" />
              <span>Yes</span>
            </label>
          </RadioGroup>
        </div>
        {hasSideEffect === "yes" ? (
          <div className="pt-subform">
            <EmergencyNote />
            <SideEffectFields values={sideEffect} onChange={setSideEffect} today={dateIn(new Date(), timeZone)} />
          </div>
        ) : null}
        {error ? (
          <p className="pt-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pt-card-actions">
          <Button type="submit" disabled={submitCheckIn.isPending}>
            Send check-in
          </Button>
          <Link href="/progress" className="btn btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}

function CheckInSent({ name, severe, nextDue }: { name: string; severe: boolean; nextDue: string | null }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // The form is gone; the reader's place moves to what replaced it.
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="pt-card" aria-labelledby="check-in-sent">
      <div>
        <h2 className="pt-card-title" id="check-in-sent" ref={heading} tabIndex={-1}>
          Thanks, {name}
        </h2>
        <p className="pt-card-sub">Your check-in is with your care team.{nextDue ? ` Your next one is due ${formatCalendarDay(nextDue)}.` : ""}</p>
      </div>
      {severe ? <EmergencyNote urgent /> : null}
      <div className="pt-card-actions">
        <Link href="/home" className="btn btn-primary">
          Back to Home
        </Link>
        <Link href="/progress" className="btn btn-outline">
          See your progress
        </Link>
      </div>
    </section>
  );
}

function PastCheckIns() {
  const me = useSignedInPatient();
  const brand = useBrand();
  const timeZone = me.timeZone ?? brand.timeZone;
  const checkIns = useCheckIns();
  return (
    <section className="pt-card" aria-labelledby="past-check-ins">
      <h2 className="pt-card-title" id="past-check-ins">
        Your check-ins
      </h2>
      {checkIns.isPending ? (
        <CardLoading label="Loading your check-ins" />
      ) : checkIns.isError ? (
        <LoadFailed what="your check-ins" onRetry={() => void checkIns.refetch()} />
      ) : checkIns.data.length === 0 ? (
        <p className="pt-muted">You haven&apos;t checked in yet.</p>
      ) : (
        <ul className="pt-list">
          {checkIns.data.map((checkIn) => (
            <li key={checkIn.checkInId} className="pt-row">
              <span className="pt-row-text">
                <span className="pt-row-title">{formatCalendarDay(dateIn(new Date(checkIn.submittedAt), timeZone))}</span>
                <span className="pt-row-sub">
                  {[
                    `Feeling: ${FEELINGS[checkIn.feeling - 1] ?? checkIn.feeling}`,
                    MISSED.find((m) => m.value === checkIn.missedDoses)?.listed,
                    checkIn.measurements.length > 0 ? `${checkIn.measurements.length} ${checkIn.measurements.length === 1 ? "measurement" : "measurements"}` : null,
                    checkIn.sideEffect ? "a side effect" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
