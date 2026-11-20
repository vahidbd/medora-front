"use client";

import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { patientApi } from "@/lib/api/patient";
import type { SideEffect, SideEffectSeverity } from "@/lib/api/types";
import { formatCalendarDate } from "@/lib/format";
import { dateIn } from "@/lib/patient-time";
import { Button } from "@/components/ui/button";
import { CardLoading, LoadFailed } from "./states";
import { EmergencyNote, NO_SIDE_EFFECT, SEVERITY_LABELS, SideEffectFields, sideEffectFrom, trackingErrorMessage } from "./tracking-fields";
import { useSideEffects, useTrackingRefresh } from "./use-tracking";

/**
 * Side effects (TRK4): report one in the patient's own words, and see what
 * has been reported. The patient is told before and after sending that a
 * report reaches no one straight away.
 */
export function SideEffectsCard({ timeZone }: { timeZone: string }) {
  const id = useId();
  const sideEffects = useSideEffects();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<SideEffectSeverity | null>(null);
  return (
    <section className="pt-card" aria-labelledby={`${id}-title`}>
      <div className="pt-card-head">
        <div>
          <h2 className="pt-card-title" id={`${id}-title`}>
            Side effects
          </h2>
          <p className="pt-card-sub">Tell your care team about anything unwanted since you started treatment.</p>
        </div>
        <Button
          variant="outline"
          aria-expanded={open}
          aria-controls={`${id}-form`}
          onClick={() => {
            setOpen((o) => !o);
            setSent(null);
          }}
        >
          Report a side effect
        </Button>
      </div>
      {sent ? (
        <div className="pt-sent" role="status">
          <p className="pt-success">Report sent. Your care team will look at it.</p>
          {sent === "severe" ? <EmergencyNote urgent /> : null}
        </div>
      ) : null}
      {open ? (
        <div id={`${id}-form`}>
          <ReportSideEffect
            timeZone={timeZone}
            onSent={(severity) => {
              setOpen(false);
              setSent(severity);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      ) : null}
      {sideEffects.isPending ? (
        <CardLoading label="Loading your side effects" />
      ) : sideEffects.isError ? (
        <LoadFailed what="your side effects" onRetry={() => void sideEffects.refetch()} />
      ) : sideEffects.data.length === 0 ? (
        <p className="pt-muted">You haven&apos;t reported any side effects.</p>
      ) : (
        <ul className="pt-list" aria-label="Side effects you've reported">
          {sideEffects.data.map((effect) => (
            <SideEffectRow key={effect.sideEffectId} effect={effect} timeZone={timeZone} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SideEffectRow({ effect, timeZone }: { effect: SideEffect; timeZone: string }) {
  const reported = formatCalendarDate(dateIn(new Date(effect.reportedAt), timeZone));
  const parts = [
    SEVERITY_LABELS[effect.severity],
    effect.reportedBy === "care_team" ? `recorded by your care team ${reported}` : `reported ${reported}`,
    effect.startedOn ? `started ${formatCalendarDate(effect.startedOn)}` : null,
  ];
  return (
    <li className="pt-row">
      <span className="pt-row-text">
        <span className="pt-row-title">{effect.description}</span>
        <span className="pt-row-sub">{parts.filter(Boolean).join(", ")}</span>
      </span>
    </li>
  );
}

function ReportSideEffect({ timeZone, onSent, onCancel }: { timeZone: string; onSent: (severity: SideEffectSeverity) => void; onCancel: () => void }) {
  const refresh = useTrackingRefresh();
  const [values, setValues] = useState(NO_SIDE_EFFECT);
  const [error, setError] = useState<string | null>(null);
  const report = useMutation({
    mutationFn: patientApi.reportSideEffect,
    onSuccess: async (effect) => {
      onSent(effect.severity);
      await refresh();
    },
    onError: (e) => setError(trackingErrorMessage(e)),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const result = sideEffectFrom(values);
    if ("error" in result) return setError(result.error);
    report.mutate(result.sideEffect);
  }

  return (
    <form className="pt-form pt-subform" onSubmit={submit} noValidate>
      <EmergencyNote />
      <SideEffectFields values={values} onChange={setValues} today={dateIn(new Date(), timeZone)} />
      {error ? (
        <p className="pt-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="pt-card-actions">
        <Button type="submit" disabled={report.isPending}>
          Send report
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
