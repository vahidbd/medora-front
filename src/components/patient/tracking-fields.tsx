"use client";

import { useId } from "react";
import { Phone, TriangleAlert } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import type { MeasurementKind, Reading, SideEffectReport, SideEffectSeverity } from "@/lib/api/types";
import { MEASUREMENT_KINDS, readingGroups } from "@/lib/measurement-kinds";
import { DateField } from "@/components/ui/date-field";
import { NumberField } from "@/components/ui/number-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

/*
 * The fields a patient fills to record readings or report a side effect,
 * shared by Progress and the check-in. The API checks every rule
 * (docs/decisions/tracking.md in medora-backend); these only check that
 * something was typed, and say what the API's refusals mean.
 */

export type ReadingValues = Partial<Record<MeasurementKind, string>>;

/** One field per kind; the two blood pressure numbers side by side. */
export function ReadingFields({ kinds, values, onChange }: { kinds: readonly MeasurementKind[]; values: ReadingValues; onChange: (kind: MeasurementKind, value: string) => void }) {
  const id = useId();
  const field = (kind: MeasurementKind, label: string) => (
    <div className="pt-field" key={kind}>
      <label className="pt-label" htmlFor={`${id}-${kind}`}>
        {label}
      </label>
      <NumberField
        id={`${id}-${kind}`}
        className="pt-reading"
        decimals={MEASUREMENT_KINDS[kind].decimals}
        min={0}
        value={values[kind] ?? ""}
        onValueChange={(value) => onChange(kind, value)}
      />
    </div>
  );
  return (
    <div className="pt-readings">
      {readingGroups(kinds).map((group) =>
        group.kind === "single" ? (
          field(group.measurement, `${MEASUREMENT_KINDS[group.measurement].label} (${MEASUREMENT_KINDS[group.measurement].unit})`)
        ) : (
          <fieldset className="pt-fieldset" key="blood_pressure">
            <legend className="pt-label">Blood pressure (mmHg)</legend>
            <div className="pt-pair">
              {field("blood_pressure_systolic", "Upper number")}
              {field("blood_pressure_diastolic", "Lower number")}
            </div>
          </fieldset>
        ),
      )}
    </div>
  );
}

/** The readings typed, or what is missing. Blank fields are left out. */
export function readingsFrom(kinds: readonly MeasurementKind[], values: ReadingValues): { readings: Reading[] } | { error: string } {
  const readings = kinds.flatMap((kind) => {
    const text = values[kind]?.trim();
    return text ? [{ kind, value: Number(text) }] : [];
  });
  const pair = readings.filter((r) => r.kind.startsWith("blood_pressure_")).length;
  if (pair === 1) return { error: "Enter both blood pressure numbers, or neither." };
  return { readings };
}

export interface SideEffectValues {
  severity: SideEffectSeverity | "";
  description: string;
  startedOn: string;
}

export const NO_SIDE_EFFECT: SideEffectValues = { severity: "", description: "", startedOn: "" };

const SEVERITIES: readonly { value: SideEffectSeverity; label: string; detail: string }[] = [
  { value: "mild", label: "Mild", detail: "You notice it, but it doesn't get in the way of your day" },
  { value: "moderate", label: "Moderate", detail: "It gets in the way of your day" },
  { value: "severe", label: "Severe", detail: "It stops you doing everyday things" },
];

export const SEVERITY_LABELS: Record<SideEffectSeverity, string> = { mild: "Mild", moderate: "Moderate", severe: "Severe" };

/** How bad it is, what is happening in the patient's words, and when it started. */
export function SideEffectFields({ values, onChange, today }: { values: SideEffectValues; onChange: (values: SideEffectValues) => void; today: string }) {
  const id = useId();
  return (
    <>
      <div className="pt-field">
        <span className="pt-label" id={`${id}-severity`}>
          How bad is it?
        </span>
        <RadioGroup
          value={values.severity}
          onValueChange={(severity) => onChange({ ...values, severity: severity as SideEffectSeverity })}
          aria-labelledby={`${id}-severity`}
          className="pt-options"
        >
          {SEVERITIES.map((option) => (
            <label key={option.value} className="pt-option">
              <RadioGroupItem value={option.value} />
              <span className="pt-option-text">
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>
      {values.severity === "severe" ? <EmergencyNote urgent /> : null}
      <div className="pt-field">
        <label className="pt-label" htmlFor={`${id}-description`}>
          What&apos;s happening?
        </label>
        <p className="pt-hint" id={`${id}-description-hint`}>
          In your own words. Your care team reads it.
        </p>
        <Textarea
          id={`${id}-description`}
          aria-describedby={`${id}-description-hint`}
          maxLength={2000}
          rows={3}
          value={values.description}
          onChange={(event) => onChange({ ...values, description: event.target.value })}
        />
      </div>
      <div className="pt-field">
        <label className="pt-label" htmlFor={`${id}-started`}>
          When did it start? (optional)
        </label>
        <DateField id={`${id}-started`} max={today} value={values.startedOn} onValueChange={(startedOn) => onChange({ ...values, startedOn })} />
      </div>
    </>
  );
}

/** The report to send, or what is missing. */
export function sideEffectFrom(values: SideEffectValues): { sideEffect: SideEffectReport } | { error: string } {
  if (!values.severity) return { error: "Choose how bad the side effect is." };
  if (!values.description.trim()) return { error: "Say what's happening, in your own words." };
  return { sideEffect: { severity: values.severity, description: values.description.trim(), startedOn: values.startedOn || null } };
}

/**
 * A report is never an emergency service (TRK4): the patient is told before
 * they send it and after. Severe says it louder.
 */
export function EmergencyNote({ urgent = false }: { urgent?: boolean }) {
  if (!urgent) {
    return (
      <p className="pt-note">
        <Phone aria-hidden />
        <span>A report doesn&apos;t reach anyone straight away. If you need help now, call 000 or go to your nearest emergency department.</span>
      </p>
    );
  }
  return (
    <div className="pt-note is-danger" role="note">
      <TriangleAlert aria-hidden />
      <span>
        <strong>If it can&apos;t wait, call 000 now</strong> or go to your nearest emergency department. A report doesn&apos;t reach anyone straight
        away.
      </span>
    </div>
  );
}

/** What the API's refusals mean to the patient. */
export function trackingErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "We couldn't save that just now. Try again.";
  switch (error.code) {
    case "out_of_range":
      return "One of those readings doesn't look right. Check the number and its unit.";
    case "blood_pressure_pair":
      return "Enter both blood pressure numbers, or neither.";
    case "blood_pressure_order":
      return "The upper blood pressure number is the higher one. Check the two numbers.";
    case "measured_in_future":
      return "That day hasn't happened yet. Choose today or an earlier day.";
    case "measured_too_long_ago":
      return "You can record readings from the last 30 days.";
    case "started_on":
      return "Check the day it started: it can't be in the future.";
    default:
      return "We couldn't save that just now. Try again.";
  }
}
